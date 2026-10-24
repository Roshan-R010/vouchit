import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireBrand } from "@/lib/brand";
import { formatDate } from "@/lib/dates";

const claimStatusLabel: Record<string, string> = {
  SUBMITTED: "New",
  UNDER_REVIEW: "In review",
  INFO_REQUESTED: "Needs information",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RESOLVED: "Resolved",
};

function claimBadgeStyle(status: string): React.CSSProperties {
  if (status === "SUBMITTED") return { background: "#edf1f9", color: "#4f6798" };
  if (status === "UNDER_REVIEW") return { background: "#fbf2df", color: "#917036" };
  if (status === "RESOLVED" || status === "APPROVED") return { background: "#eaf4e9", color: "#4e8050" };
  if (status === "REJECTED") return { background: "#faece9", color: "#a5655d" };
  return { background: "#f0f2ed", color: "#737d69" };
}

export default async function BrandDashboard({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const brand = await requireBrand(sessionId);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [allRegistrations, allClaims, products, recentClaims, recentRegistrations] = await Promise.all([
    db.warrantyRegistration.findMany({
      where: { unit: { brandId: brand.id }, customer: { demoSessionId: sessionId } },
      select: { registeredAt: true },
    }),
    db.warrantyClaim.findMany({
      where: { registration: { unit: { brandId: brand.id }, customer: { demoSessionId: sessionId } } },
      select: { status: true, issueTitle: true, reference: true, id: true, submittedAt: true },
    }),
    db.productModel.findMany({ where: { brandId: brand.id }, select: { id: true, name: true } }),
    db.warrantyClaim.findMany({
      where: { registration: { unit: { brandId: brand.id }, customer: { demoSessionId: sessionId } } },
      include: { registration: { include: { customer: true, unit: { include: { productModel: true } } } } },
      orderBy: { submittedAt: "desc" },
      take: 5,
    }),
    db.warrantyRegistration.findMany({
      where: { unit: { brandId: brand.id }, customer: { demoSessionId: sessionId }, registeredAt: { gte: thirtyDaysAgo } },
      select: { registeredAt: true },
      orderBy: { registeredAt: "asc" },
    }),
  ]);

  const openStatuses = ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"];
  const openClaims = allClaims.filter((c) => openStatuses.includes(c.status));
  const needsReview = allClaims.filter((c) => c.status === "SUBMITTED").length;

  // Build chart data for last 30 days
  const days: { label: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    const count = recentRegistrations.filter((r) => r.registeredAt.toISOString().slice(0, 10) === dateStr).length;
    days.push({ label: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(d), count });
  }

  // SVG chart
  const chartW = 440;
  const chartH = 120;
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const points = days
    .map((d, i) => {
      const x = (i / (days.length - 1)) * chartW;
      const y = chartH - (d.count / maxCount) * (chartH - 10) - 5;
      return `${x},${y}`;
    })
    .join(" ");

  // Attention items
  const attentionItems: { color: string; title: string; subtitle: string; href: string }[] = [];
  const newClaim = allClaims.find((c) => c.status === "SUBMITTED");
  if (newClaim)
    attentionItems.push({
      color: "#ef6b5e",
      title: `Review claim ${newClaim.reference}`,
      subtitle: newClaim.issueTitle,
      href: `/demo/${sessionId}/brand/claims/${newClaim.id}`,
    });
  if (allRegistrations.length > 0)
    attentionItems.push({
      color: "#d4a832",
      title: "Approve pending registrations",
      subtitle: "Proof of purchase needs review",
      href: `/demo/${sessionId}/brand/registrations`,
    });
  const infoClaim = allClaims.find((c) => c.status === "INFO_REQUESTED" || c.status === "UNDER_REVIEW");
  if (infoClaim)
    attentionItems.push({
      color: "#6b8cef",
      title: `Respond to customer`,
      subtitle: "Waiting for support update",
      href: `/demo/${sessionId}/brand/claims/${infoClaim.id}`,
    });

  return (
    <>
      <div className="business-page-header">
        <div>
          <h1>Your workspace, at a glance.</h1>
          <p>Recent registrations and claims that need your attention.</p>
        </div>
        <Link className="business-button primary" href={`/demo/${sessionId}/brand/products/new`}>
          <Plus size={15} /> Add product
        </Link>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        <div style={{ background: "#fff", border: "1px solid #e8e9e6", borderRadius: "9px", padding: "20px 22px" }}>
          <div style={{ fontSize: "11px", color: "#8b9180", marginBottom: "8px" }}>Registered warranties</div>
          <div style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-1px", color: "#1f2620", marginBottom: "6px" }}>
            {allRegistrations.length.toLocaleString()}
          </div>
          <div style={{ fontSize: "11px", color: "#5d9148", display: "flex", alignItems: "center", gap: "4px" }}>● +12.5% this month</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e8e9e6", borderRadius: "9px", padding: "20px 22px" }}>
          <div style={{ fontSize: "11px", color: "#8b9180", marginBottom: "8px" }}>Open claims</div>
          <div style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-1px", color: "#1f2620", marginBottom: "6px" }}>
            {openClaims.length}
          </div>
          {needsReview > 0 ? (
            <div style={{ fontSize: "11px", color: "#c0623a", display: "flex", alignItems: "center", gap: "4px" }}>● {needsReview} need review</div>
          ) : (
            <div style={{ fontSize: "11px", color: "#5d9148" }}>All reviewed</div>
          )}
        </div>
        <div style={{ background: "#fff", border: "1px solid #e8e9e6", borderRadius: "9px", padding: "20px 22px" }}>
          <div style={{ fontSize: "11px", color: "#8b9180", marginBottom: "8px" }}>Active products</div>
          <div style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-1px", color: "#1f2620", marginBottom: "6px" }}>
            {products.length}
          </div>
          <div style={{ fontSize: "11px", color: "#5d9148" }}>● All currently available</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e8e9e6", borderRadius: "9px", padding: "20px 22px" }}>
          <div style={{ fontSize: "11px", color: "#8b9180", marginBottom: "8px" }}>Average resolution</div>
          <div style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-1px", color: "#1f2620", marginBottom: "6px" }}>3.2 days</div>
          <div style={{ fontSize: "11px", color: "#8b9180" }}>● -18% vs last month</div>
        </div>
      </div>

      {/* Chart + Attention row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "20px", marginBottom: "24px" }}>
        <div className="business-panel" style={{ padding: "22px", overflow: "visible" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "-0.15px", color: "#232a23" }}>Warranty registrations</div>
              <div style={{ fontSize: "11px", color: "#8b9180", marginTop: "4px" }}>Registration trend over the last 30 days</div>
            </div>
            <span style={{ fontSize: "10px", border: "1px solid #e8e9e6", borderRadius: "5px", padding: "5px 9px", color: "#7a8073" }}>
              Last 30 days
            </span>
          </div>
          <svg width="100%" viewBox={`0 0 ${chartW} ${chartH + 30}`} style={{ display: "block" }}>
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3d7a3d" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#3d7a3d" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            {/* Horizontal grid lines */}
            {[0, 0.33, 0.66, 1].map((f, i) => (
              <line
                key={i}
                x1={0}
                y1={chartH - f * (chartH - 15)}
                x2={chartW}
                y2={chartH - f * (chartH - 15)}
                stroke="#eef0ea"
                strokeWidth={1}
              />
            ))}
            {/* Area fill */}
            <polygon points={`0,${chartH} ${points} ${chartW},${chartH}`} fill="url(#chartGrad)" />
            {/* Line */}
            <polyline points={points} fill="none" stroke="#3d7a3d" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {/* Dots */}
            {days.map((d, i) => {
              const x = (i / (days.length - 1)) * chartW;
              const y = chartH - (d.count / maxCount) * (chartH - 10) - 5;
              return <circle key={i} cx={x} cy={y} r={3} fill="#fff" stroke="#3d7a3d" strokeWidth="2" />;
            })}
            {/* X axis labels */}
            {[0, 5, 10, 15, 20, 25, 29].map((idx) => {
              const x = (idx / (days.length - 1)) * chartW;
              return (
                <text key={idx} x={x} y={chartH + 20} fontSize={9} fill="#a4ae94" textAnchor="middle">
                  {days[idx]?.label}
                </text>
              );
            })}
          </svg>
        </div>

        <div className="business-panel" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "-0.15px", color: "#232a23" }}>Needs your attention</div>
            {attentionItems.length > 0 && (
              <span
                style={{
                  fontSize: "10px",
                  background: "#fef2ee",
                  color: "#c45f42",
                  border: "1px solid #f5d5c8",
                  borderRadius: "5px",
                  padding: "3px 8px",
                }}
              >
                {attentionItems.length} pending
              </span>
            )}
          </div>
          <div style={{ display: "grid", gap: "14px" }}>
            {attentionItems.length === 0 && <p style={{ fontSize: "12px", color: "#8b9180" }}>Nothing urgent right now.</p>}
            {attentionItems.map((item, i) => (
              <Link key={i} href={item.href} style={{ display: "block", textDecoration: "none" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: item.color,
                      flexShrink: 0,
                      marginTop: "4px",
                    }}
                  />
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#2e3829" }}>{item.title}</div>
                    <div style={{ fontSize: "11px", color: "#8b9180", marginTop: "3px" }}>{item.subtitle}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent claims table */}
      <section className="business-panel">
        <div className="business-panel-header">
          <div>
            <h2>Recent claims</h2>
            <p>Latest warranty requests from your customers</p>
          </div>
          <Link href={`/demo/${sessionId}/brand/claims`} className="business-text-link">
            View all <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="business-table-wrap">
          <table className="business-table">
            <thead>
              <tr>
                <th>Claim</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Issue</th>
                <th>Status</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {recentClaims.map((claim) => (
                <tr key={claim.id}>
                  <td>
                    <Link className="business-row-link" href={`/demo/${sessionId}/brand/claims/${claim.id}`}>
                      {claim.reference}
                    </Link>
                  </td>
                  <td>{claim.registration.customer.name}</td>
                  <td>{claim.registration.unit.productModel.name}</td>
                  <td style={{ color: "#6f7666", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>{claim.issueTitle}</td>
                  <td>
                    <span
                      style={{
                        display: "inline-flex",
                        padding: "4px 8px",
                        borderRadius: "5px",
                        fontSize: "10px",
                        fontWeight: 600,
                        ...claimBadgeStyle(claim.status),
                      }}
                    >
                      {claimStatusLabel[claim.status]}
                    </span>
                  </td>
                  <td style={{ color: "#848b7b", fontSize: "11px" }}>{formatDate(claim.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!recentClaims.length && (
            <div className="business-empty">
              <p>Customer claims will appear here as soon as they are submitted.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
