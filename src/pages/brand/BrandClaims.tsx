import { ClaimStatusBadge } from "@/components/claim-status-badge";
import { apiFetch } from "@/lib/api-fetch";
import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Search, Filter, Inbox, CheckCircle2, ChevronRight, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/dates";

const claimStatusLabel: Record<string, string> = {
  SUBMITTED: "New / Needs Review",
  UNDER_REVIEW: "In review",
  INFO_REQUESTED: "Needs info",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RESOLVED: "Resolved",
};

function claimBadgeStyle(status: string): React.CSSProperties {
  if (status === "SUBMITTED") return { background: "#edf1f9", color: "#4f6798" };
  if (status === "UNDER_REVIEW") return { background: "#fbf2df", color: "#917036" };
  if (status === "RESOLVED" || status === "APPROVED") return { background: "#eaf4e9", color: "#4e8050" };
  if (status === "REJECTED") return { background: "#faece9", color: "#a5655d" };
  return { background: "#f0f2ed", color: "#737d69" };
}

export function BrandClaims() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentStatus = searchParams.get("status") || "all";
  const currentProduct = searchParams.get("product") || "";
  const currentSearch = searchParams.get("search") || "";

  const [claims, setClaims] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(currentSearch);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);

    const query = new URLSearchParams();
    if (currentStatus !== "all") query.set("status", currentStatus);
    if (currentProduct) query.set("product", currentProduct);
    if (currentSearch) query.set("search", currentSearch);

    apiFetch(`/api/demo/${sessionId}/brand/claims?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setClaims(data.claims || []);
        setProducts(data.products || []);
        setCounts(data.counts || {});
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load claims:", err);
        setLoading(false);
      });
  }, [sessionId, currentStatus, currentProduct, currentSearch]);

  const handleTabChange = (statusKey: string) => {
    const next = new URLSearchParams(searchParams);
    if (statusKey === "all") {
      next.delete("status");
    } else {
      next.set("status", statusKey);
    }
    setSearchParams(next);
  };

  const handleProductChange = (prodId: string) => {
    const next = new URLSearchParams(searchParams);
    if (!prodId) {
      next.delete("product");
    } else {
      next.set("product", prodId);
    }
    setSearchParams(next);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (!searchTerm.trim()) {
      next.delete("search");
    } else {
      next.set("search", searchTerm.trim());
    }
    setSearchParams(next);
  };

  const tabs = [
    { key: "all", label: "All Claims", count: counts.all ?? 0 },
    { key: "needs_review", label: "Needs Review", count: counts.needs_review ?? 0 },
    { key: "in_review", label: "In Review", count: counts.in_review ?? 0 },
    { key: "open", label: "Open", count: counts.open ?? 0 },
    { key: "resolved", label: "Resolved", count: counts.resolved ?? 0 },
    { key: "rejected", label: "Rejected", count: counts.rejected ?? 0 },
  ];

  return (
    <div>
      <div className="business-page-header">
        <div>
          <div className="business-eyebrow">Claims Inbox</div>
          <h1>Warranty Claims</h1>
          <p>Review customer evidence, request details, approve resolutions or record decisions.</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e8e9e6", marginBottom: "20px", overflowX: "auto" }}>
        {tabs.map((tab) => {
          const active = currentStatus === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              style={{
                border: 0,
                background: "transparent",
                padding: "10px 14px",
                fontSize: "14px",
                fontWeight: active ? 700 : 500,
                color: active ? "#242a25" : "#727a72",
                borderBottom: active ? "2px solid #363e31" : "2px solid transparent",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
              <span
                style={{
                  fontSize: "14px",
                  background: active ? "#e8ebe5" : "#f2f4ef",
                  padding: "2px 7px",
                  borderRadius: "10px",
                  color: active ? "#242a25" : "#80887d",
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search and Filters */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "22px" }}>
        <form onSubmit={handleSearchSubmit} className="business-search" style={{ margin: 0, flex: "1 1 280px" }}>
          <Search size={15} />
          <input
            type="text"
            placeholder="Search by claim reference, customer, or serial..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </form>

        <select
          value={currentProduct}
          onChange={(e) => handleProductChange(e.target.value)}
          style={{
            padding: "8px 12px",
            fontSize: "14px",
            border: "1px solid #dde3d6",
            borderRadius: "6px",
            background: "#fff",
            color: "#384034",
            outline: 0,
          }}
        >
          <option value="">All products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="business-panel">
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#777" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                border: "3px solid #e2e6de",
                borderTopColor: "#4a5442",
                borderRadius: "50%",
                animation: "business-spin 0.8s linear infinite",
                margin: "0 auto 10px",
              }}
            />
            Loading claims...
          </div>
        ) : claims.length === 0 ? (
          <div className="business-empty">
            <Inbox size={32} />
            <h2>No claims found</h2>
            <p>No warranty claims match your current filter criteria or search query.</p>
          </div>
        ) : (
          <div className="business-table-wrap">
            <table className="business-table">
              <thead>
                <tr>
                  <th>CLAIM REFERENCE</th>
                  <th>CUSTOMER</th>
                  <th>PRODUCT & UNIT</th>
                  <th>STATUS</th>
                  <th>SUBMITTED</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr key={claim.id}>
                    <td>
                      <Link to={`/demo/${sessionId}/brand/claims/${claim.id}`} className="business-row-link">
                        {claim.reference}
                      </Link>
                      <small>{claim.issueTitle}</small>
                    </td>
                    <td>
                      <strong>{claim.customer.name}</strong>
                      <small>{claim.customer.email}</small>
                    </td>
                    <td>
                      <strong>{claim.unit.productModel}</strong>
                      <small className="business-mono">SN: {claim.unit.serialNumber}</small>
                    </td>
                    <td>
                      <ClaimStatusBadge status={claim.status}/>
                    </td>
                    <td className="business-mono" style={{ fontSize: "14px" }}>
                      {formatDate(claim.submittedAt)}
                    </td>
                    <td>
                      <Link to={`/demo/${sessionId}/brand/claims/${claim.id}`} className="business-button small">
                        View <ChevronRight size={13} />
                      </Link>
                    </td>
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
export default BrandClaims;
