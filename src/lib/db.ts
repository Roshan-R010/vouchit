import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
try {
  if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") process.loadEnvFile();
} catch {
  // Deployed environments normally provide DATABASE_URL directly.
}
const databaseUrl = process.env.DATABASE_URL;
const pooledUrl = (() => {
  if (!databaseUrl) return undefined;
  const url = new URL(databaseUrl);
  if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "3");
  return url.toString();
})();
export const db = globalForPrisma.prisma ?? new PrismaClient(pooledUrl ? { datasources: { db: { url: pooledUrl } } } : undefined);
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
