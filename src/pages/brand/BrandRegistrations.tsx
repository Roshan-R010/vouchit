import { apiFetch } from "@/lib/api-fetch";
import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { formatDate, isCoverageActive, daysRemaining } from "@/lib/dates";

export function BrandRegistrations() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get("filter") || "";
  const filterLabel = filter === "expiring" ? "Expiring within 30 days" : filter === "missing_details" ? "Missing registration details" : "";
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    let active = true;
    apiFetch(`/api/demo/${sessionId}/brand/registrations${filterLabel ? `?filter=${filter}` : ""}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setRegistrations(data.registrations || []);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to load registrations:", err);
        setLoading(false);
      });
    return () => { active = false; };
  }, [sessionId, filter]);

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
        Loading warranty registrations...
      </div>
    );
  }

  return (
    <div>
      <div className="business-page-header">
        <div>
          <div className="business-eyebrow">Warranty Ledger</div>
          <h1>Activated Registrations</h1>
          <p>Verified coverage windows bound to customer proof of purchase and delivery date.</p>
        </div>
      </div>

      {filterLabel && <div className="business-start-strip"><span>{filterLabel} · {registrations.length} {registrations.length === 1 ? "record" : "records"}</span><button className="business-button small" onClick={() => setSearchParams({})}>Show all registrations</button></div>}
      <div className="business-panel">
        {registrations.length === 0 ? (
          <div className="business-empty">
            <ShieldCheck size={32} />
            <h2>{filterLabel ? "No registrations match this filter" : "No registrations yet"}</h2>
            <p>{filterLabel ? "You can return to all registrations using the button above." : "Customers will appear here when they register their stamped unit IDs."}</p>
          </div>
        ) : (
          <div className="business-table-wrap">
            <table className="business-table">
              <thead>
                <tr>
                  <th>STAMPED UNIT ID</th>
                  <th>PRODUCT</th>
                  <th>CUSTOMER</th>
                  <th>COVERAGE WINDOW</th>
                  <th>STATUS</th>
                  <th>CLAIM</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((r) => {
                  const active = isCoverageActive(r.coverageEndsOn);
                  const days = daysRemaining(r.coverageEndsOn);
                  return (
                    <tr key={r.id}>
                      <td className="business-mono" style={{ fontWeight: 600 }}>
                        {r.unit.serialNumber}
                      </td>
                      <td>
                        <strong>{r.unit.productModel.name}</strong>
                        <small className="business-mono">Order: {r.unit.purchaseOrder.orderNumber}</small>
                      </td>
                      <td>
                        {r.customer.name}
                        <small>{r.customer.email}</small>
                      </td>
                      <td className="business-mono" style={{ fontSize: "14px" }}>
                        {formatDate(r.coverageStartsOn)} → {formatDate(r.coverageEndsOn)}
                        <small>{active ? `${days} days remaining` : "Expired"}</small>
                      </td>
                      <td>
                        {active ? (
                          <span className="business-badge success">Active</span>
                        ) : (
                          <span className="business-badge danger">Expired</span>
                        )}
                      </td>
                      <td>
                        {r.claim ? (
                          <Link to={`/demo/${sessionId}/brand/claims/${r.claim.id}`} className="business-row-link">
                            {r.claim.reference}
                          </Link>
                        ) : (
                          <span style={{ color: "#9aa196" }}>None</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
export default BrandRegistrations;
