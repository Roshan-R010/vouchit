import { ClaimStatusBadge } from "@/components/claim-status-badge";
import { apiFetch } from "@/lib/api-fetch";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Check, ChevronDown, ChevronRight, Inbox, RotateCcw, Search, X } from "lucide-react";
import { formatDate } from "@/lib/dates";
import styles from "@/components/brand-claims.module.css";
import { ClaimQuickView } from "@/components/claim-quick-view";
import { ProductPhoto } from "@/components/product-photo";
import { createPortal } from "react-dom";
import { AnimatePresence } from "framer-motion";

type ProductOption = { id: string; name: string; issueTags: string[] };

function shuffledSample(values: string[], count: number) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy.slice(0, count);
}

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
  const selectedTags = searchParams.getAll("tag");

  const [claims, setClaims] = useState<any[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(currentSearch);
  const [moreOpen, setMoreOpen] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSearchTerm(currentSearch); }, [currentSearch]);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);

    const query = new URLSearchParams();
    if (currentStatus !== "all") query.set("status", currentStatus);
    if (currentProduct) query.set("product", currentProduct);
    if (currentSearch) query.set("search", currentSearch);
    selectedTags.forEach((tag) => query.append("tag", tag));

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
  }, [sessionId, currentStatus, currentProduct, currentSearch, selectedTags.join("\u001f")]);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [moreOpen]);

  const activeProduct = products.find((product) => product.id === currentProduct);
  const allTags = useMemo(() => Array.from(new Set(products.flatMap((product) => product.issueTags || []))), [products]);
  const tagSetKey = activeProduct ? `${activeProduct.id}:${activeProduct.issueTags.join("|")}` : `all:${allTags.join("|")}`;
  const quickTags = useMemo(() => activeProduct ? activeProduct.issueTags : shuffledSample(allTags, 6), [tagSetKey]);
  const moreTags = activeProduct ? [] : allTags.filter((tag) => !quickTags.includes(tag));
  const hiddenSelectedCount = selectedTags.filter((tag) => moreTags.includes(tag)).length;
  const filtersActive = currentStatus !== "all" || Boolean(currentProduct || currentSearch || selectedTags.length);

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
    setMoreOpen(false);
    const next = new URLSearchParams(searchParams);
    if (!prodId) {
      next.delete("product");
    } else {
      next.set("product", prodId);
    }
    next.delete("tag");
    setSearchParams(next);
  };

  const handleTagToggle = (tag: string) => {
    const next = new URLSearchParams(searchParams);
    const tags = next.getAll("tag");
    next.delete("tag");
    (tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag]).forEach((item) => next.append("tag", item));
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

  const clearSearch = () => {
    setSearchTerm("");
    const next = new URLSearchParams(searchParams);
    next.delete("search");
    setSearchParams(next);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setMoreOpen(false);
    setSearchParams(new URLSearchParams());
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
    <div className={styles.claimsLayout}>
      <div className={styles.claimsMain}>
      <div className="business-page-header">
        <div>
          <h1>Claims</h1>
          <p>Review customer evidence, request details, approve resolutions or record decisions.</p>
        </div>
      </div>

      <div className={styles.claimTabs}>
        {tabs.map((tab) => {
          const active = currentStatus === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={active ? styles.claimTabActive : styles.claimTab}
            >
              {tab.label}
              <span>{tab.count}</span>
            </button>
          );
        })}
      </div>

      <section className={styles.filterPanel} aria-label="Claim filters">
        <div className={styles.filterTopRow}>
        <form onSubmit={handleSearchSubmit} className="business-search">
          <Search size={16} />
          <input
            type="search"
            aria-label="Search claims"
            placeholder="Search reference, customer, issue, or serial"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && <button type="button" className={styles.clearSearch} aria-label="Clear search" onClick={clearSearch}><X size={15}/></button>}
        </form>

        <label className={styles.productFilter}><span>Product</span><select
          value={currentProduct}
          onChange={(e) => handleProductChange(e.target.value)}
        >
          <option value="">All products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select></label>
        {filtersActive && <button type="button" className={styles.resetFilters} onClick={resetFilters}><RotateCcw size={15}/> Reset filters</button>}
        </div>

        <div className={styles.tagFilterBlock}>
          {quickTags.length > 0 ? <div className={styles.tagFilterList}>
            {quickTags.map((tag) => <button type="button" key={tag} className={selectedTags.includes(tag) ? styles.tagFilterActive : styles.tagFilter} aria-pressed={selectedTags.includes(tag)} onClick={() => handleTagToggle(tag)}>{selectedTags.includes(tag) && <Check size={14}/>} {tag}</button>)}
            {moreTags.length > 0 && <div className={styles.moreFilter} ref={moreRef}>
              <button type="button" className={styles.moreButton} aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>More{hiddenSelectedCount > 0 && <span>{hiddenSelectedCount}</span>}<ChevronDown size={15}/></button>
              {moreOpen && <div className={styles.moreMenu} role="group" aria-label="More issue tags">{moreTags.map((tag) => <label key={tag}><input type="checkbox" checked={selectedTags.includes(tag)} onChange={() => handleTagToggle(tag)}/><span>{tag}</span></label>)}</div>}
            </div>}
          </div> : <p className={styles.noTags}>{activeProduct ? "This product has no issue tags configured yet." : "Add issue tags to products to filter claims here."}</p>}
        </div>
      </section>

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
            <p>No warranty claims match the selected status, product, tags, or search.</p>
            {filtersActive && <button type="button" className="business-button" onClick={resetFilters}>Reset filters</button>}
          </div>
        ) : (
          <div className="business-table-wrap">
            <table className={`business-table ${styles.claimsTable}`}>
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
                  <tr key={claim.id} onClick={() => setSelectedClaimId(claim.id)}>
                    <td>
                      <button type="button" onClick={() => setSelectedClaimId(claim.id)} className={styles.claimOpen}>
                        {claim.reference}
                      </button>
                      <small>{claim.issueTitle}</small>
                    </td>
                    <td>
                      <strong>{claim.customer.name}</strong>
                      <small>{claim.customer.email}</small>
                    </td>
                    <td>
                      <span className={styles.productCell}>{claim.unit.imageUrl ? <ProductPhoto src={claim.unit.imageUrl} alt={claim.unit.productModel}/> : <span className={styles.productPlaceholder}/>}<span><strong>{claim.unit.productModel}</strong><small>{claim.unit.sku ? `SKU: ${claim.unit.sku}` : `SN: ${claim.unit.serialNumber}`}</small></span></span>
                    </td>
                    <td>
                      <ClaimStatusBadge status={claim.status}/>
                    </td>
                    <td className="business-mono" style={{ fontSize: "14px" }}>
                      {formatDate(claim.submittedAt)}
                    </td>
                    <td>
                      <button type="button" onClick={() => setSelectedClaimId(claim.id)} className={styles.viewButton}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
      {createPortal(<AnimatePresence>{selectedClaimId && sessionId && <ClaimQuickView key={selectedClaimId} sessionId={sessionId} claimId={selectedClaimId} onClose={() => setSelectedClaimId(null)}/>}</AnimatePresence>, document.body)}
    </div>
  );
}
export default BrandClaims;
