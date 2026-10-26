import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response } from "express";
import { db } from "../src/lib/db";

const scrypt = promisify(scryptCallback);
const cookieName = "vouch_session";
const lifetime = 30 * 24 * 60 * 60 * 1000;

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
  const session = await db.authSession.findUnique({ where: { tokenHash: tokenHash(token) }, include: { account: true } });
  return session && session.expiresAt > new Date() ? session.account : null;
}

export async function endSession(req: Request, res: Response) {
  const token = /(?:^|;\s*)vouch_session=([^;]+)/.exec(req.headers.cookie || "")?.[1];
  if (token) await db.authSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
  res.clearCookie(cookieName, { path: "/" });
}
