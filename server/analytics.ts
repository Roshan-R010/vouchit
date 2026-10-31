import { db } from "../src/lib/db";

export function summarizeIssueCounts(products: { id: string; issueTags: string[] }[], rows: { tag: string; count: number }[]) {
  const counts = new Map<string, { tag: string; count: number; tone: number }>();
  for (const product of products) product.issueTags.forEach((tag, index) => {
    if (!counts.has(tag)) counts.set(tag, { tag, count: 0, tone: index % 6 });
  });
  const olderTags = [...new Set(rows.map(row => row.tag))].filter(tag => !counts.has(tag)).sort((a, b) => a.localeCompare(b));
  olderTags.forEach((tag, index) => counts.set(tag, { tag, count: 0, tone: index % 6 }));
  for (const row of rows) {
    const entry = counts.get(row.tag);
    if (entry) entry.count += row.count;
  }
  const reported = [...counts.values()].filter(item => item.count > 0).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  return { issueCounts: reported.slice(0, 5), issueTagTotal: reported.length, issueCountTotal: reported.reduce((sum, item) => sum + item.count, 0) };
}

export function summarizeIssues(products: { id: string; issueTags: string[] }[], claims: { issueTags: string[] }[]) {
  const counts = new Map<string, number>();
  for (const claim of claims) for (const tag of new Set(claim.issueTags)) counts.set(tag, (counts.get(tag) || 0) + 1);
  return summarizeIssueCounts(products, [...counts].map(([tag, count]) => ({ tag, count })));
}

export async function loadAnalytics(brandId: string, sessionId: string, periodDays: number) {
  const [registrations, claims, products] = await Promise.all([
    db.warrantyRegistration.findMany({ where: { unit: { brandId }, customer: { demoSessionId: sessionId } }, select: { active: true, registeredAt: true, coverageEndsOn: true, unit: { select: { productModelId: true } } } }),
    db.warrantyClaim.findMany({ where: { registration: { unit: { brandId }, customer: { demoSessionId: sessionId } } }, select: { status: true, issueTags: true, submittedAt: true, registration: { select: { unit: { select: { productModelId: true } } } }, events: { where: { toStatus: "RESOLVED" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } } }),
    db.productModel.findMany({ where: { brandId }, select: { id: true, name: true, issueTags: true }, orderBy: { name: "asc" } }),
  ]);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const approved = claims.filter(c => c.status === "APPROVED" || c.status === "RESOLVED").length;
  const decided = approved + claims.filter(c => c.status === "REJECTED").length;
  const resolvedHours = claims.filter(c => c.status === "RESOLVED" && c.events[0]).map(c => Math.max(0, (c.events[0].createdAt.getTime() - c.submittedAt.getTime()) / 3600000));
  const allIssues = summarizeIssues(products, claims);
  const trend = Array.from({ length: periodDays }, (_, index) => {
    const date = new Date(today); date.setUTCDate(today.getUTCDate() - periodDays + index + 1);
    const key = date.toISOString().slice(0, 10);
    return { date: key, label: date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }), count: registrations.filter(r => r.registeredAt.toISOString().startsWith(key)).length, claims: claims.filter(c => c.submittedAt.toISOString().startsWith(key)).length };
  });
  return {
    periodDays,
    metrics: {
      totalRegistrations: registrations.length,
      activeRegistrations: registrations.filter(r => r.active && r.coverageEndsOn >= today).length,
      totalClaims: claims.length,
      openClaims: claims.filter(c => ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED", "APPROVED"].includes(c.status)).length,
      approvalRate: decided ? Math.round(approved / decided * 100) : null,
      averageResolutionHours: resolvedHours.length ? Math.round(resolvedHours.reduce((sum, h) => sum + h, 0) / resolvedHours.length * 10) / 10 : null,
      resolvedClaims: claims.filter(c => c.status === "RESOLVED").length,
    },
    trend,
    statusCounts: ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED", "APPROVED", "REJECTED", "RESOLVED"].map(status => ({ status, count: claims.filter(c => c.status === status).length })),
    ...allIssues,
    productStats: products.map(product => {
      const registered = registrations.filter(r => r.unit.productModelId === product.id).length;
      const productClaims = claims.filter(c => c.registration.unit.productModelId === product.id);
      const filed = productClaims.length;
      return { ...product, registrations: registered, claims: filed, claimRate: registered ? Math.round(filed / registered * 1000) / 10 : null, ...summarizeIssues([product], productClaims) };
    }),
  };
}
