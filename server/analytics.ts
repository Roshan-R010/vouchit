import { db } from "../src/lib/db";

export async function loadAnalytics(brandId: string, sessionId: string, periodDays: number) {
  const [registrations, claims, products] = await Promise.all([
    db.warrantyRegistration.findMany({ where: { unit: { brandId }, customer: { demoSessionId: sessionId } }, select: { registeredAt: true, coverageEndsOn: true, unit: { select: { productModelId: true } } } }),
    db.warrantyClaim.findMany({ where: { registration: { unit: { brandId }, customer: { demoSessionId: sessionId } } }, select: { status: true, issueTags: true, submittedAt: true, registration: { select: { unit: { select: { productModelId: true } } } }, events: { where: { toStatus: "RESOLVED" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } } }),
    db.productModel.findMany({ where: { brandId }, select: { id: true, name: true, issueTags: true }, orderBy: { name: "asc" } }),
  ]);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const approved = claims.filter(c => c.status === "APPROVED" || c.status === "RESOLVED").length;
  const decided = approved + claims.filter(c => c.status === "REJECTED").length;
  const resolvedHours = claims.filter(c => c.status === "RESOLVED" && c.events[0]).map(c => Math.max(0, (c.events[0].createdAt.getTime() - c.submittedAt.getTime()) / 3600000));
  const summarizeIssues = (selectedProducts: typeof products, selectedClaims: typeof claims) => {
    const counts = new Map<string, { tag: string; count: number; tone: number }>();
    for (const product of selectedProducts) product.issueTags.forEach((tag, index) => {
      if (!counts.has(tag)) counts.set(tag, { tag, count: 0, tone: index % 6 });
    });
    const olderTags = [...new Set(selectedClaims.flatMap(claim => claim.issueTags))].filter(tag => !counts.has(tag)).sort((a, b) => a.localeCompare(b));
    olderTags.forEach((tag, index) => counts.set(tag, { tag, count: 0, tone: index % 6 }));
    for (const claim of selectedClaims) for (const tag of new Set(claim.issueTags)) {
      const entry = counts.get(tag);
      if (entry) entry.count++;
    }
    const reported = [...counts.values()].filter(item => item.count > 0).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    return { issueCounts: reported.slice(0, 5), issueTagTotal: reported.length };
  };
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
      activeRegistrations: registrations.filter(r => r.coverageEndsOn >= today).length,
      totalClaims: claims.length,
      openClaims: claims.filter(c => ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"].includes(c.status)).length,
      approvalRate: decided ? Math.round(approved / decided * 100) : null,
      averageResolutionHours: resolvedHours.length ? Math.round(resolvedHours.reduce((sum, h) => sum + h, 0) / resolvedHours.length * 10) / 10 : null,
      resolvedClaims: resolvedHours.length,
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
