import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BarChart3, TrendingUp, CheckCircle, Clock, ShieldCheck } from "lucide-react";

export function BrandAnalytics() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    fetch(`/api/demo/${sessionId}/brand/analytics`)
      .then((res) => res.json())
      .then((resData) => {
        setData(resData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load analytics:", err);
        setLoading(false);
      });
  }, [sessionId]);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#777" }}>
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
        Loading operational analytics...
      </div>
    );
  }

  const metrics = data?.metrics || {
    totalRegistrations: 0,
    totalClaims: 0,
    approvalRate: "100%",
    activeProducts: 0,
    averageResolutionHours: 28,
  };
  const productStats: any[] = data?.productStats || [];

  return (
    <div>
      <div className="business-page-header">
        <div>
          <div className="business-eyebrow">Operational Metrics</div>
          <h1>Warranty & Claims Analytics</h1>
          <p>Product reliability rates, claims resolution velocity, and warranty obligations.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "26px" }}>
        <div className="business-panel" style={{ padding: "18px 20px", marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#7a807b", fontSize: "11px", fontWeight: 600 }}>
            <span>ACTIVE REGISTRATIONS</span>
            <ShieldCheck size={16} color="#556b4f" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-1px", color: "#242a25", margin: "8px 0 2px" }}>
            {metrics.totalRegistrations}
          </div>
          <div style={{ fontSize: "11px", color: "#8a9184" }}>Registered customer units</div>
        </div>

        <div className="business-panel" style={{ padding: "18px 20px", marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#7a807b", fontSize: "11px", fontWeight: 600 }}>
            <span>CLAIMS INITIATED</span>
            <TrendingUp size={16} color="#4f6798" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-1px", color: "#242a25", margin: "8px 0 2px" }}>
            {metrics.totalClaims}
          </div>
          <div style={{ fontSize: "11px", color: "#8a9184" }}>Total claims recorded</div>
        </div>

        <div className="business-panel" style={{ padding: "18px 20px", marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#7a807b", fontSize: "11px", fontWeight: 600 }}>
            <span>APPROVAL RATE</span>
            <CheckCircle size={16} color="#4e8050" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-1px", color: "#242a25", margin: "8px 0 2px" }}>
            {metrics.approvalRate}
          </div>
          <div style={{ fontSize: "11px", color: "#8a9184" }}>Resolved or approved</div>
        </div>

        <div className="business-panel" style={{ padding: "18px 20px", marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#7a807b", fontSize: "11px", fontWeight: 600 }}>
            <span>AVG RESOLUTION VELOCITY</span>
            <Clock size={16} color="#8a7337" />
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-1px", color: "#242a25", margin: "8px 0 2px" }}>
            {metrics.averageResolutionHours}h
          </div>
          <div style={{ fontSize: "11px", color: "#8a9184" }}>Turnaround from review to resolution</div>
        </div>
      </div>

      {/* Product Failure/Claim Rate Breakdown */}
      <div className="business-panel">
        <div className="business-panel-header">
          <div>
            <h2>Product Model Performance Breakdown</h2>
            <p>Incident rate per registered model to identify quality patterns.</p>
          </div>
        </div>

        <div className="business-table-wrap">
          <table className="business-table">
            <thead>
              <tr>
                <th>PRODUCT MODEL</th>
                <th>UNITS REGISTERED</th>
                <th>CLAIMS RECORDED</th>
                <th>INCIDENT RATE</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {productStats.map((p) => {
                const numericRate = parseFloat(p.claimRate);
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                    </td>
                    <td>{p.registrations}</td>
                    <td>{p.claims}</td>
                    <td className="business-mono" style={{ fontWeight: 600 }}>
                      {p.claimRate}
                    </td>
                    <td>
                      {numericRate < 10 ? (
                        <span className="business-badge success">Optimal</span>
                      ) : (
                        <span className="business-badge warning">Watch</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default BrandAnalytics;
