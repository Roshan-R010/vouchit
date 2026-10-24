import { apiFetch } from "@/lib/api-fetch";
import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ShieldCheck, CheckCircle } from "lucide-react";

export function CustomerRegister() {
  const { sessionId, brandSlug, productSlug } = useParams<{ sessionId: string; brandSlug: string; productSlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [serialNumber, setSerialNumber] = useState(searchParams.get("serialNumber") || "");
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!sessionId) return; void apiFetch(`/api/demo/${sessionId}/customer`).then(response => response.json()).then(data => { if (data.customer) { setCustomerName(current => current || data.customer.name); setEmail(current => current || data.customer.email); } }).catch(() => {}); }, [sessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !brandSlug || !productSlug) return;
    setError(null);
    setSubmitting(true);

    try {
      const response = await apiFetch(`/api/demo/${sessionId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandSlug,
          productSlug,
          serialNumber: serialNumber.trim().toUpperCase(),
          customerName: customerName.trim(),
          email: email.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Registration failed. Check your stamped unit ID.");
      }

      navigate(`/demo/${sessionId}/customer/products/${data.unitId}`);
    } catch (err: any) {
      setError(err.message || "Failed to register unit.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page-wrap form-shell" style={{ margin: "40px auto" }}>
      <div className="form-header">
        <Link to={`/demo/${sessionId}/customer`} className="reset-link" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 10 }}>
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <h1>Register Your Hardware</h1>
        <p>Bind your stamped unit ID with manufacturer delivery verification to activate warranty.</p>
      </div>

      <div className="form-body">
        {error && <div className="notice error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Stamped Unit ID (Serial Number) *</label>
            <input
              type="text"
              placeholder="e.g. KST-PRO-1001"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
              required
            />
            <small style={{ fontSize: "14px", color: "#888" }}>
              Located directly on the hardware body or retail gift box barcode.
            </small>
          </div>

          <div className="field">
            <label>Your Full Name *</label>
            <input
              type="text"
              placeholder="e.g. Maya Lin"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label>Contact Email *</label>
            <input
              type="email"
              placeholder="e.g. maya@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={submitting} className="action" style={{ width: "100%", justifyContent: "center", marginTop: "12px" }}>
            {submitting ? "Verifying & Activating..." : "Activate Warranty Coverage"}
          </button>
        </form>
      </div>
    </main>
  );
}
export default CustomerRegister;
