import { ClaimStatus, Prisma } from "@prisma/client";
import { db } from "../src/lib/db";
import { dateOnly } from "../src/lib/dates";
import { summarizeIssueCounts } from "./analytics";

const DAY = 86_400_000;
const key = (date: Date) => date.toISOString().slice(0, 10);

export function registrationAttentionWhere(filter: unknown, now = new Date()): Prisma.WarrantyRegistrationWhereInput {
  const today = dateOnly(now);
  if (filter === "expiring") return {
    active: true,
    coverageStartsOn: { lte: today },
    coverageEndsOn: { gte: today, lte: new Date(today.getTime() + 30 * DAY) },
  };
  if (filter === "missing_details") return {
    OR: [
      { customer: { name: "" } }, { customer: { email: "" } },
      { unit: { serialNumber: "" } },
    ],
  };
  return {};
}

function dailySeries(rows: Date[], start: Date, days: number) {
  const counts = new Map<string, number>();
  for (const date of rows) counts.set(key(date), (counts.get(key(date)) || 0) + 1);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY);
    return { date: key(date), label: date.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" }), count: counts.get(key(date)) || 0 };
  });
}

export async function loadBrandDashboard(brandId: string, sessionId: string, periodDays: 7 | 30 | 90) {
  const today = dateOnly(new Date());
  const firstDay = new Date(today.getTime() - (periodDays - 1) * DAY);
  const tomorrow = new Date(today.getTime() + DAY);
  const weekStart = new Date(today.getTime() - 6 * DAY);
  const scope: Prisma.WarrantyRegistrationWhereInput = { unit: { brandId }, customer: { demoSessionId: sessionId } };
  const claimScope: Prisma.WarrantyClaimWhereInput = { registration: scope };
  const [totalRegistrations, claimCounts, products, missingDetailsCount, registrations, submittedClaims, upcomingExpirations, recentClaims, resolvedThisWeek, issueCounts] = await Promise.all([
    db.warrantyRegistration.count({ where: scope }),
    db.warrantyClaim.groupBy({ by: ["status"], where: claimScope, _count: { _all: true } }),
    db.productModel.findMany({ where: { brandId }, select: { id: true, name: true, issueTags: true }, orderBy: { name: "asc" } }),
    db.warrantyRegistration.count({ where: { AND: [scope, registrationAttentionWhere("missing_details", today)] } }),
    db.warrantyRegistration.findMany({ where: { AND: [scope, { registeredAt: { gte: firstDay, lt: tomorrow } }] }, select: { registeredAt: true } }),
    db.warrantyClaim.findMany({ where: { AND: [claimScope, { submittedAt: { gte: firstDay, lt: tomorrow } }] }, select: { submittedAt: true } }),
    db.warrantyRegistration.findMany({ where: { AND: [scope, registrationAttentionWhere("expiring", today)] }, select: { coverageEndsOn: true } }),
    db.warrantyClaim.findMany({ where: claimScope, orderBy: [{ submittedAt: "desc" }, { id: "desc" }], take: 5, select: {
      id: true, reference: true, status: true, submittedAt: true,
      registration: { select: { customer: { select: { name: true, email: true } }, unit: { select: { serialNumber: true, productModel: { select: { name: true, imageUrl: true } } } } } },
    } }),
    db.claimEvent.groupBy({ by: ["claimId"], where: { toStatus: ClaimStatus.RESOLVED, createdAt: { gte: weekStart, lt: tomorrow }, claim: { ...claimScope, status: ClaimStatus.RESOLVED } } }),
    db.$queryRaw<{ productId: string; tag: string; count: number }[]>(Prisma.sql`
      SELECT u."productModelId" AS "productId", issue.tag AS tag, COUNT(DISTINCT c.id)::integer AS count
      FROM "WarrantyClaim" c
      JOIN "WarrantyRegistration" r ON r.id = c."registrationId"
      JOIN "ProductUnit" u ON u.id = r."unitId"
      JOIN "Customer" customer ON customer.id = r."customerId"
      CROSS JOIN LATERAL unnest(c."issueTags") AS issue(tag)
      WHERE u."brandId" = ${brandId}::uuid AND customer."demoSessionId" = ${sessionId}::uuid
      GROUP BY u."productModelId", issue.tag
    `),
  ]);
  const count = (status: ClaimStatus) => claimCounts.find(row => row.status === status)?._count._all || 0;
  const issues = summarizeIssueCounts(products, issueCounts);
  return {
    periodDays,
    metrics: {
      totalRegistrations, productsCount: products.length, expiringSoonCount: upcomingExpirations.length, missingDetailsCount,
      needsReviewCount: count(ClaimStatus.SUBMITTED),
      openClaimsCount: count(ClaimStatus.SUBMITTED) + count(ClaimStatus.UNDER_REVIEW) + count(ClaimStatus.INFO_REQUESTED) + count(ClaimStatus.APPROVED),
      resolvedThisWeek: resolvedThisWeek.length, periodRegistrations: registrations.length, periodClaims: submittedClaims.length,
    },
    chartData: dailySeries(registrations.map(row => row.registeredAt), firstDay, periodDays),
    claimSeries: dailySeries(submittedClaims.map(row => row.submittedAt), firstDay, periodDays),
    expirationSeries: dailySeries(upcomingExpirations.map(row => row.coverageEndsOn), today, 31),
    products: products.map(({ id, name }) => ({ id, name })),
    issues: { ...issues, byProduct: products.map(product => ({ productId: product.id, ...summarizeIssueCounts([product], issueCounts.filter(row => row.productId === product.id)) })) },
    recentClaims: recentClaims.map(claim => ({
      id: claim.id, reference: claim.reference, status: claim.status, submittedAt: claim.submittedAt,
      customer: claim.registration.customer,
      unit: { serialNumber: claim.registration.unit.serialNumber, productModel: claim.registration.unit.productModel },
    })),
  };
}
