import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, Plus, Inbox, Package, Users, ShieldCheck, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/dates";

const claimStatusLabel: Record<string, string> = {
  SUBMITTED: "New",
  UNDER_REVIEW: "In review",
  INFO_REQUESTED: "Needs info",
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

export function BrandDashboard() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    fetch(`/api/demo/${sessionId}/brand`)
      .then((res) => res.json())
      .then((resData) => {
        setData(resData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load dashboard:", err);
        setLoading(false);
      });
  }, [sessionId]);

  if (loading) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "#777" }}>
        <div
          style={{
            width: "30px",
            height: "30px",
            border: "3px solid #e2e6de",
            borderTopColor: "#4a5442",
            borderRadius: "50%",
            animation: "business-spin 0.8s linear infinite",
            margin: "0 auto 12px",
          }}
        />
        Loading workspace dashboard...
      </div>
    );
  }

  const brand = data?.brand || { name: "Kestrel Audio" };
  const metrics = data?.metrics || {
    totalRegistrations: 0,
    openClaimsCount: 0,
    needsReviewCount: 0,
    productsCount: 0,
  };
  const chartData: { label: string; count: number }[] = data?.chartData || [];
  const recentClaims: any[] = data?.recentClaims || [];

  const maxChartCount = Math.max(1, ...chartData.map((d) => d.count));

  return (
    <div>
      <div className="business-page-header">
        <div>
          <div className="business-eyebrow">Workspace Overview</div>
          <h1>{brand.name} Operations</h1>
          <p>Real-time warranty registrations, claims review, and warranty aftercare health.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link to={`/demo/${sessionId}/brand/products/new`} className="business-button primary">
            <Plus size={15} /> Add product
          </Link>
          <Link to={`/demo/${sessionId}/customer`} className="business-button">
            Customer portal <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "26px" }}>
        <div className="business-panel" style={{ padding: "18px 20px", marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#7a807b", fontSize: "11px", fontWeight: 600 }}>
            <span>REGISTERED UNITS</span>
            <ShieldCheck size={16} color="#556b4f" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-1px", color: "#242a25", margin: "8px 0 2px" }}>
            {metrics.totalRegistrations}
          </div>
          <div style={{ fontSize: "11px", color: "#8a9184" }}>Active warranty records</div>
        </div>

        <div className="business-panel" style={{ padding: "18px 20px", marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#7a807b", fontSize: "11px", fontWeight: 600 }}>
            <span>OPEN CLAIMS</span>
            <Inbox size={16} color="#8a7337" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-1px", color: "#242a25", margin: "8px 0 2px" }}>
            {metrics.openClaimsCount}
          </div>
          <div style={{ fontSize: "11px", color: "#8a9184" }}>Under active processing</div>
        </div>

        <div className="business-panel" style={{ padding: "18px 20px", marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#7a807b", fontSize: "11px", fontWeight: 600 }}>
            <span>NEEDS REVIEW</span>
            <AlertCircle size={16} color="#a5655d" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-1px", color: metrics.needsReviewCount > 0 ? "#a5655d" : "#242a25", margin: "8px 0 2px" }}>
            {metrics.needsReviewCount}
          </div>
          <div style={{ fontSize: "11px", color: "#8a9184" }}>Requires decision today</div>
        </div>

        <div className="business-panel" style={{ padding: "18px 20px", marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#7a807b", fontSize: "11px", fontWeight: 600 }}>
            <span>CATALOG MODELS</span>
            <Package size={16} color="#4f6798" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-1px", color: "#242a25", margin: "8px 0 2px" }}>
            {metrics.productsCount}
          </div>
          <div style={{ fontSize: "11px", color: "#8a9184" }}>Products in warranty catalog</div>
        </div>
      </div>

      {/* 30-Day Registration Trend Chart */}
      <div className="business-panel">
        <div className="business-panel-header">
          <div>
            <h2>30-Day Registrations Trend</h2>
            <p>New unit warranty activations recorded over the last month.</p>
          </div>
          <Link to={`/demo/${sessionId}/brand/registrations`} className="business-text-link">
            View all registrations →
          </Link>
        </div>
        <div style={{ padding: "24px 22px 18px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "130px", borderBottom: "1px solid #eef0eb", paddingBottom: "8px" }}>
            {chartData.map((day, idx) => {
              const heightPercent = Math.max(8, Math.round((day.count / maxChartCount) * 100));
              return (
                <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }} title={`${day.label}: ${day.count} registrations`}>
                  <div
                    style={{
                      width: "100%",
                      maxWidth: "20px",
                      height: `${heightPercent}%`,
                      background: day.count > 0 ? "#536148" : "#edf1ea",
                      borderRadius: "3px 3px 0 0",
                      transition: "height 0.3s ease",
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#9ca395", marginTop: "8px" }}>
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </div>
      </div>

      {/* Recent Claims Inbox */}
      <div className="business-panel">
        <div className="business-panel-header">
          <div>
            <h2>Recent Claims Attention</h2>
            <p>Customer submissions awaiting review or updates.</p>
          </div>
          <Link to={`/demo/${sessionId}/brand/claims`} className="business-button small">
            Open Claims Inbox
          </Link>
        </div>

        {recentClaims.length === 0 ? (
          <div className="business-empty">
            <CheckCircle2 size={32} color="#748c66" />
            <h2>No claims pending review</h2>
            <p>All customer warranty claims have been processed or none have been submitted yet.</p>
          </div>
        ) : (
          <div className="business-table-wrap">
            <table className="business-table">
              <thead>
                <tr>
                  <th>CLAIM</th>
                  <th>CUSTOMER</th>
                  <th>PRODUCT</th>
                  <th>STATUS</th>
                  <th>SUBMITTED</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentClaims.map((claim) => (
                  <tr key={claim.id}>
                    <td>
                      <Link to={`/demo/${sessionId}/brand/claims/${claim.id}`} className="business-row-link">
                        {claim.reference}
                      </Link>
                      <small>{claim.issueTitle}</small>
                    </td>
                    <td>{claim.customerName}</td>
                    <td>{claim.productName}</td>
                    <td>
                      <span className="business-badge" style={claimBadgeStyle(claim.status)}>
                        {claimStatusLabel[claim.status] || claim.status}
                      </span>
                    </td>
                    <td className="business-mono" style={{ fontSize: "11px" }}>
                      {formatDate(claim.submittedAt)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link to={`/demo/${sessionId}/brand/claims/${claim.id}`} className="business-button small">
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
export default BrandDashboard;
