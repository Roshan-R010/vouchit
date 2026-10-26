import { apiFetch } from "@/lib/api-fetch";
import { ProductPhoto } from "@/components/product-photo";
import { BrandIdentityHeader } from "@/components/brand-identity-header";
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, Box } from "lucide-react";
import { formatDate } from "@/lib/dates";

export function CustomerDashboard() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");

  useEffect(() => {
    setLoading(true);
    apiFetch(sessionId ? `/api/demo/${sessionId}/customer` : "/api/account/customer")
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

  const brand = data?.brand || { name: "Your brand", slug: "" };
  const warranties: any[] = data?.warranties || [];

  const filteredWarranties = warranties.filter((w) => {
    if (filter === "active") return w.isActive;
    if (filter === "expired") return !w.isActive;
    return true;
  });

  return (
    <main className="page-wrap content">
      <BrandIdentityHeader
        brand={brand}
        eyebrow="Warranties & support"
        title="Your warranties, in one place."
        description="See the products you have registered, check your remaining coverage, and follow your support claims."
      />

      {/* Filters and Registration Action */}
      <div className="filters">
        <button
          className={`filter ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          My warranties <span className="filter-count">{warranties.length}</span>
        </button>
        <button
          className={`filter ${filter === "active" ? "active" : ""}`}
          onClick={() => setFilter("active")}
        >
          Active <span className="filter-count">{warranties.filter((w) => w.isActive).length}</span>
        </button>
        <button
          className={`filter ${filter === "expired" ? "active" : ""}`}
          onClick={() => setFilter("expired")}
        >
          Expired <span className="filter-count">{warranties.filter((w) => !w.isActive).length}</span>
        </button>

      </div>

      {/* Warranties Grid */}
      {filteredWarranties.length === 0 ? (
        <div className="blank-state" style={{ margin: "32px 0" }}>
          <h3>{warranties.length ? "No warranties match this filter" : "No registered products yet"}</h3>
          <p>{warranties.length ? "Choose another filter to see your products." : "Open a product link shared by a brand to register your warranty."}</p>
        </div>
      ) : (
        <div className="product-grid">
          {filteredWarranties.map((w) => (
            <article key={w.unitId} className="product-card">
              <div className="product-art">
                {w.imageUrl ? <ProductPhoto src={w.imageUrl} alt={w.productName} fit="cover" /> : <Box size={54} color="#353b34" />}
              </div>

              <div className="product-copy">
                <span className={`badge ${w.isActive ? "" : "expired"}`}>
                  {w.isActive ? "Covered" : "Expired"}
                </span>

                <h2>{w.productName}</h2>
                <p>{w.brandName} · Serial {w.serialNumber}</p>

                <div className="warranty-remaining">
                  <strong>{w.isActive ? w.daysRemaining : 0}</strong>
                  <span>{w.isActive ? "days of warranty left" : "warranty expired"}</span>
                </div>

                <div className="progress">
                  <span style={{ width: `${w.progressPercent}%` }} />
                </div>

                <div className="product-meta">
                  <span>Delivered:</span>
                  <b>{w.deliveredOn ? formatDate(w.deliveredOn) : "—"}</b>
                </div>

                <div className="card-actions">
                  <Link to={`/demo/${w.demoSessionId || sessionId}/customer/products/${w.unitId}`} className="action secondary">
                    Warranty details
                  </Link>

                  {w.claim ? (
                    <Link to={`/demo/${w.demoSessionId || sessionId}/customer/claims/${w.claim.id}`} className="action">
                      View claim <ArrowUpRight size={15}/>
                    </Link>
                  ) : w.isActive ? (
                    <Link to={`/demo/${w.demoSessionId || sessionId}/customer/claims/new?unitId=${w.unitId}`} className="action">
                      Raise a claim <ArrowUpRight size={15}/>
                    </Link>
                  ) : (
                    <span style={{ fontSize: "14px", color: "#888", alignSelf: "center", marginLeft: "auto" }}>
                      Expired
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

    </main>
  );
}
export default CustomerDashboard;
