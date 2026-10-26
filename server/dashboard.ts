import { ClaimStatus, Prisma } from "@prisma/client";
import { db } from "../src/lib/db";
import { dateOnly } from "../src/lib/dates";

export function registrationAttentionWhere(filter: unknown, now = new Date()): Prisma.WarrantyRegistrationWhereInput {
  const today = dateOnly(now);
  if (filter === "expiring") return {
    coverageStartsOn: { lte: today },
    coverageEndsOn: { gte: today, lte: new Date(today.getTime() + 30 * 86_400_000) },
  };
  if (filter === "missing_details") return {
    OR: [
      { customer: { name: "" } }, { customer: { email: "" } },
      { unit: { serialNumber: "" } },
      { unit: { purchaseOrder: { orderNumber: "" } } },
      { unit: { purchaseOrder: { deliveredOn: null } } },
    ],
  };
  return {};
}

export async function loadBrandDashboard(brandId: string, sessionId: string, periodDays: 30 | 90) {
  const today = dateOnly(new Date());
  const firstDay = new Date(today.getTime() - (periodDays - 1) * 86_400_000);
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const scope: Prisma.WarrantyRegistrationWhereInput = {
    unit: { brandId }, customer: { demoSessionId: sessionId },
  };
  const [totalRegistrations, claimCounts, productsCount, expiringSoonCount, missingDetailsCount, activity, recentRegistrations] = await Promise.all([
    db.warrantyRegistration.count({ where: scope }),
    db.warrantyClaim.groupBy({ by: ["status"], where: { registration: scope }, _count: { _all: true } }),
    db.productModel.count({ where: { brandId } }),
    db.warrantyRegistration.count({ where: { AND: [scope, registrationAttentionWhere("expiring", today)] } }),
    db.warrantyRegistration.count({ where: { AND: [scope, registrationAttentionWhere("missing_details", today)] } }),
    db.warrantyRegistration.findMany({ where: { ...scope, registeredAt: { gte: firstDay, lt: tomorrow } }, select: { registeredAt: true } }),
    db.warrantyRegistration.findMany({
      where: scope, orderBy: [{ registeredAt: "desc" }, { id: "desc" }], take: 5,
      select: {
        id: true, registeredAt: true,
        customer: { select: { name: true, email: true } },
        unit: { select: { serialNumber: true, productModel: { select: { id: true, name: true, imageUrl: true } } } },
      },
    }),
  ]);
  const count = (status: ClaimStatus) => claimCounts.find(row => row.status === status)?._count._all || 0;
  const dailyCounts = new Map<string, number>();
  for (const row of activity) {
    const day = row.registeredAt.toISOString().slice(0, 10);
    dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1);
  }
  return {
    periodDays,
    metrics: {
      totalRegistrations, productsCount, expiringSoonCount, missingDetailsCount,
      needsReviewCount: count(ClaimStatus.SUBMITTED),
      openClaimsCount: count(ClaimStatus.SUBMITTED) + count(ClaimStatus.UNDER_REVIEW) + count(ClaimStatus.INFO_REQUESTED),
    },
    chartData: Array.from({ length: periodDays }, (_, index) => {
      const day = new Date(firstDay.getTime() + index * 86_400_000);
      return { label: day.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" }), count: dailyCounts.get(day.toISOString().slice(0, 10)) || 0 };
    }),
    recentRegistrations,
  };
}
