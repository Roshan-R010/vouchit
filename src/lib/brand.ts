import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";

export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// React.cache() deduplicates this per request — layout + page both call it
// but only one DB query runs per render cycle.
export const requireBrand = cache(async (sessionId: string) => {
  if (!isUuid(sessionId)) notFound();
  const brand = await db.brand.findFirst({ where: { demoSessionId: sessionId } });
  if (!brand) {
    const session = await db.demoSession.findUnique({ where: { id: sessionId }, select: { id: true } });
    if (!session) redirect("/demo?view=brand");
    redirect(`/demo/${sessionId}/setup`);
  }
  return brand;
});
