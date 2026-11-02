import { db } from "@/lib/db";
import type { Brand } from "@prisma/client";

export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const brandCache = new Map<string, { expiresAt: number; value: Promise<Brand> }>();
const brandCacheMs = 10_000;

export function invalidateBrand(sessionId: string) {
  brandCache.delete(sessionId);
}

export async function requireBrand(sessionId: string) {
  if (!isUuid(sessionId)) {
    throw new Error("Invalid session ID format");
  }
  const cached = brandCache.get(sessionId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (brandCache.size > 1_000) brandCache.clear();
  const value = db.brand.findFirst({ where: { demoSessionId: sessionId } }).then(brand => {
    if (!brand) throw new Error("Brand not found for this demo session");
    return brand;
  }).catch(error => { if (brandCache.get(sessionId)?.value === value) brandCache.delete(sessionId); throw error; });
  brandCache.set(sessionId, { expiresAt: Date.now() + brandCacheMs, value });
  return value;
}
