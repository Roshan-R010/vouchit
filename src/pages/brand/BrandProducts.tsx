import { apiFetch } from "@/lib/api-fetch";
import { ProductPhoto } from "@/components/product-photo";
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, Package, Copy, Check, ExternalLink } from "lucide-react";
import { BrandCopyLink } from "@/components/brand-copy-link";

export function BrandProducts() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [products, setProducts] = useState<any[]>([]);
  const [brand, setBrand] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    apiFetch(`/api/demo/${sessionId}/brand/products`)
      .then((res) => res.json())
      .then((data) => {
        setProducts(data.products || []);
        setBrand(data.brand);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load products:", err);
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
        Loading products catalog...
      </div>
    );
  }

  return (
    <div>
      <div className="business-page-header">
        <div>
          <div className="business-eyebrow">Product Catalog</div>
          <h1>Warrantied Models</h1>
          <p>Manage product models, standard warranty periods, and stamped unit registration links.</p>
        </div>
        <Link to={`/demo/${sessionId}/brand/products/new`} className="business-button add-product-button">
          Add product
        </Link>
      </div>

      <div className="business-catalog">
        {products.map((p) => {
          const registeredCount = p.units?.filter((u: any) => u.registration).length || 0;
          const totalUnits = p.units?.length || 0;
          const regLink = `/demo/${sessionId}/register/${brand?.slug || ""}/${p.slug}`;

          return (
            <div key={p.id} className="business-product-card">
              <div className="business-product-image">
                {p.imageUrl ? (
                  <ProductPhoto src={p.imageUrl} alt={p.name} />
                ) : (
                  <Package size={44} strokeWidth={1.5} />
                )}
              </div>
              <div className="business-product-card-body">
                <div className="business-product-title">
                  <span>{p.name}</span>
                  <span className="business-badge">{p.warrantyMonths}m Warranty</span>
                </div>
                <div className="business-muted">SKU: {p.sku || "N/A"}</div>

                <div className="business-product-facts">
                  <div>
                    <span>Total Units:</span> <strong>{totalUnits}</strong>
                  </div>
                  <div>
                    <span>Registered:</span> <strong>{registeredCount}</strong>
                  </div>
                </div>

                <div style={{ marginTop: "14px", display: "flex", gap: "8px" }}>
                  <Link to={`/demo/${sessionId}/brand/products/${p.id}`} className="business-button small" style={{ flex: 1 }}>
                    Manage product
                  </Link>
                  <Link
                    to={regLink}
                    target="_blank"
                    rel="noreferrer"
                    className="business-button small"
                    title="Open customer registration link"
                  >
                    <ExternalLink size={13} />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default BrandProducts;
