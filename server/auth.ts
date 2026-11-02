import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response } from "express";
import { db } from "../src/lib/db";
import type { Account } from "@prisma/client";

const scrypt = promisify(scryptCallback);
const cookieName = "vouch_session";
const lifetime = 30 * 24 * 60 * 60 * 1000;
const sessionCache = new Map<string, { expiresAt: number; account: Promise<Account | null> }>();
const sessionCacheMs = 5_000;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, encoded] = stored.split(":");
  if (!salt || !encoded || encoded.length !== 128) return false;
  const expected = Buffer.from(encoded, "hex");
  const actual = await scrypt(password, salt, 64) as Buffer;
  return timingSafeEqual(expected, actual);
}

function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }

export async function startSession(accountId: string, res: Response) {
  const token = randomBytes(32).toString("base64url");
  await db.authSession.create({ data: { accountId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + lifetime) } });
  res.cookie(cookieName, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: lifetime });
}

export async function currentAccount(req: Request) {
  const token = /(?:^|;\s*)vouch_session=([^;]+)/.exec(req.headers.cookie || "")?.[1];
  if (!token) return null;
  const key = tokenHash(token);
  const now = Date.now();
  const cached = sessionCache.get(key);
  if (cached && cached.expiresAt > now) return cached.account;
  if (cached) sessionCache.delete(key);
  if (sessionCache.size > 1_000) sessionCache.clear();
  const entry: { expiresAt: number; account: Promise<Account | null> } = { expiresAt: now + sessionCacheMs, account: Promise.resolve(null) };
  entry.account = db.authSession.findUnique({ where: { tokenHash: key }, include: { account: true } }).then(session => {
    if (!session || session.expiresAt.getTime() <= Date.now()) { sessionCache.delete(key); return null; }
    entry.expiresAt = Math.min(entry.expiresAt, session.expiresAt.getTime());
    return session.account;
  }).catch(error => { sessionCache.delete(key); throw error; });
  sessionCache.set(key, entry);
  return entry.account;
}

export async function endSession(req: Request, res: Response) {
  const token = /(?:^|;\s*)vouch_session=([^;]+)/.exec(req.headers.cookie || "")?.[1];
  if (token) { const key = tokenHash(token); sessionCache.delete(key); await db.authSession.deleteMany({ where: { tokenHash: key } }); sessionCache.delete(key); }
  res.clearCookie(cookieName, { path: "/" });
}
