import { db } from "../src/lib/db";

export async function loadAnalytics(brandId: string, sessionId: string, periodDays: number) {
  const [registrations, claims, products] = await Promise.all([
    db.warrantyRegistration.findMany({ where: { unit: { brandId }, customer: { demoSessionId: sessionId } }, select: { registeredAt: true, coverageEndsOn: true, unit: { select: { productModelId: true } } } }),
    db.warrantyClaim.findMany({ where: { registration: { unit: { brandId }, customer: { demoSessionId: sessionId } } }, select: { status: true, submittedAt: true, registration: { select: { unit: { select: { productModelId: true } } } }, events: { where: { toStatus: "RESOLVED" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } } }),
    db.productModel.findMany({ where: { brandId }, select: { id: true, name: true } }),
  ]);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const approved = claims.filter(c => c.status === "APPROVED" || c.status === "RESOLVED").length;
  const decided = approved + claims.filter(c => c.status === "REJECTED").length;
  const resolvedHours = claims.filter(c => c.status === "RESOLVED" && c.events[0]).map(c => Math.max(0, (c.events[0].createdAt.getTime() - c.submittedAt.getTime()) / 3600000));
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
    productStats: products.map(product => {
      const registered = registrations.filter(r => r.unit.productModelId === product.id).length;
      const filed = claims.filter(c => c.registration.unit.productModelId === product.id).length;
      return { ...product, registrations: registered, claims: filed, claimRate: registered ? Math.round(filed / registered * 1000) / 10 : null };
    }),
  };
}
