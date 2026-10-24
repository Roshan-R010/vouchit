import { apiFetch } from "@/lib/api-fetch";
import { ProductPhoto } from "@/components/product-photo";
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, Box, Plus } from "lucide-react";
import { formatDate } from "@/lib/dates";

export function CustomerDashboard() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    apiFetch(`/api/demo/${sessionId}/customer`)
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
  const productsToRegister: any[] = (data?.availableProducts || []).filter((product: any) => !warranties.some((w) => w.productModelId === product.id));

  const filteredWarranties = warranties.filter((w) => {
    if (filter === "active") return w.isActive;
    if (filter === "expired") return !w.isActive;
    return true;
  });

  return (
    <main className="page-wrap content">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">{brand.name} Customer Care</span>
          <h1>Your products,<br/>covered.</h1>
          <p>Register a product, check remaining coverage, and track support requests.</p>
        </div>
        {data?.availableProducts?.[0]?.imageUrl && <div className="customer-hero-photo" aria-hidden="true"><ProductPhoto src={data.availableProducts[0].imageUrl} alt=""/></div>}
      </section>

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

        <div style={{ marginLeft: "auto" }}>
          <Link to={`/demo/${sessionId}/customer/register`} className="action">
            <Plus size={16} /> Register a product
          </Link>
        </div>
      </div>

      {/* Warranties Grid */}
      {productsToRegister.length > 0 && <section aria-label={`${brand.name} product catalog`}><div className="section-head"><div><h2>{brand.name} products</h2><p>Choose a product you own to register its warranty.</p></div></div><div className="customer-catalog">{productsToRegister.map((product: any) => <article key={product.id}><div className="customer-catalog-photo">{product.imageUrl && <ProductPhoto src={product.imageUrl} alt={product.name}/>}</div><div><h2>{product.name}</h2><p>{product.warrantyMonths} months of warranty</p><Link className="action" to={`/demo/${sessionId}/register/${brand.slug}/${product.slug}`}>Register warranty <ArrowUpRight size={16}/></Link></div></article>)}</div></section>}
      {filteredWarranties.length === 0 ? (
        <div className="blank-state" style={{ margin: "32px 0" }}>
          <h3>{warranties.length ? "No warranties match this filter" : "No registered products yet"}</h3>
          <p>{warranties.length ? "Choose another filter to see your products." : "Register a product to see its coverage and time remaining."}</p>
        </div>
      ) : (
        <div className="product-grid">
          {filteredWarranties.map((w) => (
            <article key={w.unitId} className="product-card">
              <div className="product-art">
                {w.imageUrl ? <ProductPhoto src={w.imageUrl} alt={w.productName} /> : <Box size={54} color="#353b34" />}
              </div>

              <div className="product-copy">
                <span className={`badge ${w.isActive ? "" : "expired"}`}>
                  {w.isActive ? "Covered" : "Expired"}
                </span>

                <h2>{w.productName}</h2>
                <p>Stamped ID: {w.serialNumber}</p>

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
                  <Link to={`/demo/${sessionId}/customer/products/${w.unitId}`} className="action secondary">
                    Warranty details
                  </Link>

                  {w.claim ? (
                    <Link to={`/demo/${sessionId}/customer/claims/${w.claim.id}`} className="action">
                      View claim <ArrowUpRight size={15}/>
                    </Link>
                  ) : w.isActive ? (
                    <Link to={`/demo/${sessionId}/customer/claims/new?unitId=${w.unitId}`} className="action">
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
