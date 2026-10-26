import { AddProductUnit } from "@/components/add-product-unit";
import { ProductIssueTags } from "@/components/product-issue-tags";
import { apiFetch } from "@/lib/api-fetch";
import { ProductPhoto } from "@/components/product-photo";
import { ProductImageEditor } from "@/components/product-image-editor";
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Package, ExternalLink, ImagePlus } from "lucide-react";
import { formatDate } from "@/lib/dates";

export function BrandProductDetail() {
  const { sessionId, productId } = useParams<{ sessionId: string; productId: string }>();
  const [version, setVersion] = useState(0);
  const [product, setProduct] = useState<any>(null);
  const [brand, setBrand] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingImage, setEditingImage] = useState(false);

  useEffect(() => {
    if (!sessionId || !productId) return;
    setLoading(true);
    apiFetch(`/api/demo/${sessionId}/brand/products/${productId}`)
      .then((res) => res.json())
      .then((data) => {
        setProduct(data.product);
        setBrand(data.brand);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load product:", err);
        setLoading(false);
      });
  }, [sessionId, productId, version]);

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
        Loading product details...
      </div>
    );
  }

  if (!product) {
    return (
      <div>
        <Link to={`/demo/${sessionId}/brand/products`} className="business-back">
          <ArrowLeft size={14} /> Back to products
        </Link>
        <div className="business-notice error">Product could not be found.</div>
      </div>
    );
  }

  const regUrl = `${window.location.origin}/demo/${sessionId}/register/${brand?.slug || ""}/${product.slug}`;

  return (
    <div>
      <Link to={`/demo/${sessionId}/brand/products`} className="business-back">
        <ArrowLeft size={14} /> Back to products
      </Link>

      <div className="business-product-overview">
        <div className="business-product-image">
          {product.imageUrl ? <ProductPhoto src={product.imageUrl} alt={product.name} /> : <Package size={44} />}
        </div>
        <div>
          <div className="business-eyebrow">Product Model</div>
          <h2>{product.name}</h2>
          <p>
            SKU: {product.sku || "N/A"} · {product.warrantyMonths} Months Warranty Coverage
          </p>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span className="business-badge success">{product.units?.length || 0} Units Tracked</span>
            <a
              href={`/demo/${sessionId}/register/${brand?.slug || ""}/${product.slug}`}
              target="_blank"
              rel="noreferrer"
              className="business-text-link"
            >
              Open registration page <ExternalLink size={12} />
            </a>
          </div>
          <button type="button" className="business-button small" style={{ marginTop: 14 }} onClick={() => setEditingImage(true)}><ImagePlus size={16}/> Change image</button>
        </div>
      </div>

      {editingImage && sessionId && productId && <ProductImageEditor sessionId={sessionId} productId={productId} productName={product.name} imageUrl={product.imageUrl} onClose={() => setEditingImage(false)} onSaved={(url) => { setProduct((current: any) => ({ ...current, imageUrl: url })); setEditingImage(false); }}/ >}

      {sessionId && productId && <ProductIssueTags key={productId} sessionId={sessionId} productId={productId} initialTags={product.issueTags || []}/>}
      {sessionId && productId && <AddProductUnit sessionId={sessionId} productId={productId} onSaved={() => setVersion(value => value + 1)}/>}
      {/* Units Table */}
      <div className="business-panel">
        <div className="business-panel-header">
          <div>
            <h2>Stamped Units & Delivery Records</h2>
            <p>Individual serial numbers manufactured and their fulfillment orders.</p>
          </div>
        </div>

        {product.units?.length === 0 ? (
          <div className="business-empty">
            <h2>No units stamped yet</h2>
            <p>Add serial numbers and purchase orders to track individual warranties.</p>
          </div>
        ) : (
          <div className="business-table-wrap">
            <table className="business-table">
              <thead>
                <tr>
                  <th>STAMPED UNIT ID</th>
                  <th>PURCHASE ORDER</th>
                  <th>DELIVERY DATE</th>
                  <th>REGISTRATION STATUS</th>
                  <th>CUSTOMER</th>
                </tr>
              </thead>
              <tbody>
                {product.units?.map((u: any) => (
                  <tr key={u.id}>
                    <td className="business-mono" style={{ fontWeight: 600 }}>
                      {u.serialNumber}
                    </td>
                    <td className="business-mono">{u.purchaseOrder?.orderNumber || "—"}</td>
                    <td className="business-mono">
                      {u.purchaseOrder?.deliveredOn ? formatDate(u.purchaseOrder.deliveredOn) : "Pending"}
                    </td>
                    <td>
                      {u.registration ? (
                        <span className="business-badge success">Registered</span>
                      ) : (
                        <span className="business-badge">Unregistered</span>
                      )}
                    </td>
                    <td>{u.registration?.customer?.name || "—"}</td>
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
export default BrandProductDetail;
