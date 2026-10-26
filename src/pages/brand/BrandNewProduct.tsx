import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";
import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { IssueTagEditor } from "@/components/issue-tag-editor";

export function BrandNewProduct() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [warrantyMonths, setWarrantyMonths] = useState<number | "">("");
  const [serialNumber, setSerialNumber] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [deliveredOn, setDeliveredOn] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [issueTags, setIssueTags] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;
    setError(null);
    setSubmitting(true);

    try {
      const response = await apiFetch(`/api/demo/${sessionId}/brand/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sku,
          warrantyMonths,
          issueTags,
          serialNumber: serialNumber || undefined,
          orderNumber: orderNumber || undefined,
          deliveredOn: deliveredOn || undefined,
          imageDataUrl: image ? await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(image); }) : undefined,
        }),
      });

      const data = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || "Failed to create product");
      }

      navigate(`/demo/${sessionId}/brand/products`);
    } catch (err: any) {
      setError(err.message || "Failed to create product");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="business-form-page">
      <Link to={`/demo/${sessionId}/brand/products`} className="business-back">
        <ArrowLeft size={14} /> Back to products
      </Link>

      <div className="business-page-header">
        <div>
          <div className="business-eyebrow">New Catalog Item</div>
          <h1>Add Warrantied Product</h1>
          <p>Define product specifications, duration of standard warranty, and add delivered units.</p>
        </div>
      </div>

      {error && <div className="business-notice error">{error}</div>}

      <div className="business-panel">
        <form onSubmit={handleSubmit} className="business-form-section">
          <div className="business-field">
            <label>Product Name *</label>
            <input
              type="text"
              placeholder="Product model name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="business-field">
            <label>Product picture <span>Optional · PNG, JPG or WebP up to 5 MB</span></label>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setImage(e.target.files?.[0] || null)} />
          </div>

          <div className="business-form-grid">
            <div className="business-field">
              <label>SKU / Model Number</label>
              <input
                type="text"
                placeholder="Manufacturer SKU"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </div>

            <div className="business-field">
              <label>Warranty Duration (Months) *</label>
              <input
                type="number"
                min={1}
                max={120}
                value={warrantyMonths}
                onChange={(e) => setWarrantyMonths(e.target.value === "" ? "" : Number(e.target.value))}
                required
              />
            </div>
          </div>

          <IssueTagEditor value={issueTags} onChange={setIssueTags} disabled={submitting}/>

          <details className="business-details" open>
            <summary>Add a delivered unit and order (optional)</summary>
            <div className="business-hint">
              Enter the serial number and order from the actual purchase to enable customer registration.
            </div>

            <div className="business-form-grid">
              <div className="business-field">
                <label>Stamped Unit ID (Serial Number)</label>
                <input
                  type="text"
                  placeholder="Actual serial number"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
                />
              </div>

              <div className="business-field">
                <label>Purchase Order Reference</label>
                <input
                  type="text"
                  placeholder="Actual order reference"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="business-field" style={{ maxWidth: "260px" }}>
              <label>Delivery Date</label>
              <input
                type="date"
                value={deliveredOn}
                onChange={(e) => setDeliveredOn(e.target.value)}
              />
            </div>
          </details>

          <div className="business-form-footer">
            <Link to={`/demo/${sessionId}/brand/products`} className="business-button">
              Cancel
            </Link>
            <button type="submit" disabled={submitting} className="business-button primary">
              {submitting ? "Saving Product..." : "Create Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
export default BrandNewProduct;
