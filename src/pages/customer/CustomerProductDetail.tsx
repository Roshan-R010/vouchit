import { apiFetch } from "@/lib/api-fetch";
import { ProductPhoto } from "@/components/product-photo";
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Headphones, ShieldCheck, BatteryCharging } from "lucide-react";
import { formatDate, isCoverageActive, daysRemaining } from "@/lib/dates";

export function CustomerProductDetail() {
  const { sessionId, unitId } = useParams<{ sessionId: string; unitId: string }>();
  const [registration, setRegistration] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId || !unitId) return;
    setLoading(true);
    apiFetch(`/api/demo/${sessionId}/customer/products/${unitId}`)
      .then((res) => res.json())
      .then((data) => {
        setRegistration(data.registration);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load unit:", err);
        setLoading(false);
      });
  }, [sessionId, unitId]);

  if (loading) {
    return (
      <main className="page-wrap" style={{ padding: "60px 0", textAlign: "center" }}>
        Loading product warranty...
      </main>
    );
  }

  if (!registration) {
    return (
      <main className="page-wrap">
        <div className="notice error">Warranty registration not found.</div>
      </main>
    );
  }

  const { unit, coverageStartsOn, coverageEndsOn, claim } = registration;
  const active = isCoverageActive(coverageEndsOn);
  const days = daysRemaining(coverageEndsOn);

  return (
    <main className="page-wrap form-shell" style={{ margin: "30px auto" }}>
      <div className="form-header">
        <Link to="/customer" className="reset-link" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <h1>{unit.productModel.name}</h1>
        <p>Manufacturer Warranty Coverage Record</p>
      </div>

      <div className="form-body">
        {unit.productModel.imageUrl && <div style={{ height: 240, marginBottom: 24 }}><ProductPhoto src={unit.productModel.imageUrl} alt={unit.productModel.name} /></div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "26px" }}>
          <div>
            <div style={{ fontSize: "14px", color: "#888", fontWeight: 700 }}>STAMPED UNIT ID</div>
            <strong style={{ fontSize: "14px" }}>{unit.serialNumber}</strong>
          </div>
          <div>
            <div style={{ fontSize: "14px", color: "#888", fontWeight: 700 }}>PURCHASE ORDER</div>
            <div style={{ fontSize: "14px" }}>{unit.purchaseOrder.orderNumber}</div>
          </div>
          <div>
            <div style={{ fontSize: "14px", color: "#888", fontWeight: 700 }}>DELIVERY DATE</div>
            <div>{unit.purchaseOrder.deliveredOn ? formatDate(unit.purchaseOrder.deliveredOn) : "N/A"}</div>
          </div>
          <div>
            <div style={{ fontSize: "14px", color: "#888", fontWeight: 700 }}>COVERAGE STATUS</div>
            <span className={`badge ${active ? "" : "expired"}`}>
              {active ? `Active (${days} days remaining)` : "Expired"}
            </span>
          </div>
        </div>

        <div className="match-panel">
          <strong>Coverage Window:</strong>
          <p>
            From {formatDate(coverageStartsOn)} through {formatDate(coverageEndsOn)}. Covers manufacturer defects, hardware failures, and original workmanship.
          </p>
        </div>

        <div className={`customer-product-action-row${claim ? " is-centered" : ""}`}>
          {claim ? (
            <Link to={`/demo/${sessionId}/customer/claims/${claim.id}`} className="action customer-view-claim">
              View claim
            </Link>
          ) : active ? (
            <Link to={`/demo/${sessionId}/customer/claims/new?unitId=${unit.id}`} className="action">
              Raise a claim
            </Link>
          ) : (
            <span style={{ fontSize: "15px", color: "#888" }}>This warranty has expired and cannot accept claims.</span>
          )}
        </div>
      </div>
    </main>
  );
}
export default CustomerProductDetail;
