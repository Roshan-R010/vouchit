import { apiFetch } from "@/lib/api-fetch";
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Users, Mail, ShieldCheck, Inbox } from "lucide-react";
import { formatDate } from "@/lib/dates";

export function BrandCustomers() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    apiFetch(`/api/demo/${sessionId}/brand/customers`)
      .then((res) => res.json())
      .then((data) => {
        setCustomers(data.customers || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load customers:", err);
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
        Loading customers directory...
      </div>
    );
  }

  return (
    <div>
      <div className="business-page-header">
        <div>
          <div className="business-eyebrow">Customer Directory</div>
          <h1>Customers & Owners</h1>
          <p>Verified purchasers who have registered their stamped product units.</p>
        </div>
      </div>

      <div className="business-panel">
        <div className="business-table-wrap">
          <table className="business-table">
            <thead>
              <tr>
                <th>CUSTOMER</th>
                <th>CONTACT EMAIL</th>
                <th>REGISTERED PRODUCTS</th>
                <th>ORDERS</th>
                <th>CLAIMS FILED</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const totalClaims = c.registrations?.filter((r: any) => r.claim).length || 0;
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="business-person">
                        <span>{c.name.slice(0, 1).toUpperCase()}</span>
                        <strong>{c.name}</strong>
                      </div>
                    </td>
                    <td className="business-mono" style={{ color: "#6a7364" }}>
                      {c.email}
                    </td>
                    <td>
                      <span className="business-badge success">{c.registrations?.length || 0} Registered</span>
                    </td>
                    <td className="business-mono">{c.orders?.length || 0}</td>
                    <td>
                      {totalClaims > 0 ? (
                        <span className="business-badge warning">{totalClaims} Claims</span>
                      ) : (
                        <span className="business-badge">0 Claims</span>
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
export default BrandCustomers;
