import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, ArrowRight, ShieldCheck, AlertCircle, Headphones, BatteryCharging, Box, ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/dates";

export function CustomerDashboard() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    fetch(`/api/demo/${sessionId}/customer`)
      .then((res) => res.json())
      .then((resData) => {
        setData(resData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load customer dashboard:", err);
        setLoading(false);
      });
  }, [sessionId]);

  if (loading) {
    return (
      <main className="page-wrap" style={{ padding: "60px 0", textAlign: "center" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            border: "3px solid #e0dfdb",
            borderTopColor: "#f26054",
            borderRadius: "50%",
            animation: "business-spin 0.8s linear infinite",
            margin: "0 auto 12px",
          }}
        />
        Loading warranty records...
      </main>
    );
  }

  const customer = data?.customer;
  const brand = data?.brand || { name: "Kestrel Audio", slug: "kestrel" };
  const warranties: any[] = data?.warranties || [];
  const notifications: any[] = data?.notifications || [];

  const filteredWarranties = warranties.filter((w) => {
    if (filter === "active") return w.isActive;
    if (filter === "expired") return !w.isActive;
    return true;
  });

  const activeClaims = warranties.filter((w) => w.claim && w.claim.status !== "RESOLVED" && w.claim.status !== "REJECTED");

  return (
    <main className="page-wrap content">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">{brand.name} Customer Care</span>
          <h1>Product coverage, always in reach.</h1>
          <p>View active warranties, track service claims, and register new stamped hardware.</p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="headphone" />
        </div>
        <div className="hero-stripe" />
      </section>

      {/* Filters and Registration Action */}
      <div className="filters">
        <button
          className={`filter ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All Products <span className="filter-count">{warranties.length}</span>
        </button>
        <button
          className={`filter ${filter === "active" ? "active" : ""}`}
          onClick={() => setFilter("active")}
        >
          Active Coverage <span className="filter-count">{warranties.filter((w) => w.isActive).length}</span>
        </button>
        <button
          className={`filter ${filter === "expired" ? "active" : ""}`}
          onClick={() => setFilter("expired")}
        >
          Expired <span className="filter-count">{warranties.filter((w) => !w.isActive).length}</span>
        </button>

        <div style={{ marginLeft: "auto" }}>
          <Link to={`/demo/${sessionId}/register/${brand.slug}/kestrel-pro-headphones`} className="action" style={{ fontSize: "11px", padding: "8px 14px" }}>
            <Plus size={14} /> Register another product
          </Link>
        </div>
      </div>

      {/* Warranties Grid */}
      {filteredWarranties.length === 0 ? (
        <div className="blank-state" style={{ margin: "32px 0" }}>
          <h3>No warrantied products found</h3>
          <p>You do not currently have any products matching this filter.</p>
        </div>
      ) : (
        <div className="product-grid">
          {filteredWarranties.map((w) => (
            <article key={w.unitId} className="product-card">
              <div className="product-art">
                {w.productName.toLowerCase().includes("charge") ? (
                  <BatteryCharging size={54} color="#353b34" />
                ) : (
                  <Headphones size={54} color="#353b34" />
                )}
              </div>

              <div className="product-copy">
                <span className={`badge ${w.isActive ? "" : "expired"}`}>
                  {w.isActive ? "Covered" : "Expired"}
                </span>

                <h2>{w.productName}</h2>
                <p>Stamped ID: {w.serialNumber}</p>

                <div className="warranty-remaining">
                  <strong>{w.isActive ? w.daysRemaining : 0}</strong>
                  <span>{w.isActive ? "days coverage remaining" : "days coverage expired"}</span>
                </div>

                <div className="progress">
                  <span style={{ width: `${w.progressPercent}%` }} />
                </div>

                <div className="product-meta">
                  <span>Delivered:</span>
                  <b>{w.deliveredOn ? formatDate(w.deliveredOn) : "—"}</b>
                </div>

                <div className="card-actions">
                  <Link to={`/demo/${sessionId}/customer/products/${w.unitId}`} className="action secondary">
                    Details
                  </Link>

                  {w.claim ? (
                    <Link to={`/demo/${sessionId}/customer/claims/${w.claim.id}`} className="action">
                      Track Claim
                    </Link>
                  ) : w.isActive ? (
                    <Link to={`/demo/${sessionId}/customer/claims/new?unitId=${w.unitId}`} className="action">
                      File Claim
                    </Link>
                  ) : (
                    <span style={{ fontSize: "11px", color: "#888", alignSelf: "center", marginLeft: "auto" }}>
                      Expired
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Active Claims Attention Section */}
      {activeClaims.length > 0 && (
        <div>
          <div className="section-head">
            <div>
              <h2>Ongoing Claims In Progress</h2>
              <p>Updates on your recent service and warranty requests.</p>
            </div>
          </div>

          <div className="claims-list">
            {activeClaims.map((w) => (
              <div key={w.claim.id} className="claim-row">
                <div>
                  <div className="claim-name">{w.claim.issueTitle}</div>
                  <div className="muted">{w.claim.reference}</div>
                </div>
                <div className="claim-product">{w.productName}</div>
                <div className="claim-date muted">{formatDate(w.claim.submittedAt)}</div>
                <div>
                  <span className={`status-pill ${w.claim.status.toLowerCase().replace("_", "-")}`}>
                    {w.claim.status.replace("_", " ")}
                  </span>
                </div>
                <Link to={`/demo/${sessionId}/customer/claims/${w.claim.id}`}>
                  <ArrowRight size={16} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notifications Drawer */}
      {notifications.length > 0 && (
        <div style={{ marginTop: "40px" }}>
          <div className="section-head">
            <div>
              <h2>Recent Service Notifications</h2>
              <p>Simulated transactional notifications regarding warranty and claims.</p>
            </div>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            {notifications.slice(0, 3).map((notif: any) => (
              <div key={notif.id} className="message" style={{ margin: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <strong>{notif.subject}</strong>
                  <span style={{ fontSize: "11px", color: "#888" }}>{formatDate(notif.createdAt)}</span>
                </div>
                <div style={{ fontSize: "12px", color: "#555" }}>{notif.previewBody}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
export default CustomerDashboard;
