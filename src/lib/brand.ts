import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function requireBrand(sessionId: string) {
  if (!isUuid(sessionId)) notFound();
  const brand = await db.brand.findFirst({ where: { demoSessionId: sessionId } });
  if (!brand) notFound();
  return brand;
}
