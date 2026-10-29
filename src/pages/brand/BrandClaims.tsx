import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Inbox, Search, SlidersHorizontal, X } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { shortClaimReference } from "@/lib/claim-reference";
import { ClaimQuickView } from "@/components/claim-quick-view";
import { ClaimInboxStatus } from "@/components/claim-inbox-status";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import styles from "./claims-inbox.module.css";

type ProductOption = { id: string; name: string; issueTags: string[] };
type ClaimRow = { id: string; reference: string; status: string; issueTitle: string; submittedAt: string; customer: { name: string; email: string }; unit: { productModel: string; serialNumber: string; orderNumber: string | null } };
const PAGE_SIZE = 10;
const statusOptions = [["all", "All statuses"], ["open", "All open claims"], ["needs_review", "Needs review"], ["in_review", "In progress"], ["INFO_REQUESTED", "Needs info"], ["APPROVED", "Approved"], ["rejected", "Rejected"], ["RESOLVED", "Resolved"], ["resolved", "Approved & resolved"]];

export function BrandClaims() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentStatus = searchParams.get("status") || "all";
  const currentProduct = searchParams.get("product") || "";
  const currentSearch = searchParams.get("search") || "";
  const tagsKey = JSON.stringify(searchParams.getAll("tag"));
  const selectedTags = useMemo<string[]>(() => JSON.parse(tagsKey), [tagsKey]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState(currentSearch);
  const [filtersOpen, setFiltersOpen] = useState(Boolean(currentProduct || selectedTags.length));
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [oldestFirst, setOldestFirst] = useState(false);
  const filterButton = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const closeClaim = useCallback(() => setSelectedClaimId(null), []);
  const refreshClaims = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => { setSearchTerm(currentSearch); }, [currentSearch]);
  useEffect(() => { setPage(1); }, [currentStatus, currentProduct, currentSearch, tagsKey, oldestFirst]);
  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    setLoading(true); setError("");
    const query = new URLSearchParams();
    if (currentStatus !== "all") query.set("status", currentStatus);
    if (currentProduct) query.set("product", currentProduct);
    if (currentSearch) query.set("search", currentSearch);
    selectedTags.forEach(tag => query.append("tag", tag));
    apiFetch(`/api/demo/${sessionId}/brand/claims?${query}`, { cache: "no-store" }).then(readApiResponse)
      .then(data => { if (active) { setClaims(data.claims || []); setProducts(data.products || []); setCounts(data.counts || {}); } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Could not load claims."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionId, currentStatus, currentProduct, currentSearch, selectedTags, revision]);

  function changeFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (!value || (key === "status" && value === "all")) next.delete(key); else next.set(key, value);
    if (key === "product") next.delete("tag");
    setSearchParams(next);
  }
  function toggleTag(tag: string) {
    const next = new URLSearchParams(searchParams); next.delete("tag");
    (selectedTags.includes(tag) ? selectedTags.filter(value => value !== tag) : [...selectedTags, tag]).forEach(value => next.append("tag", value));
    setSearchParams(next);
  }
  function submitSearch(event: FormEvent) { event.preventDefault(); changeFilter("search", searchTerm.trim()); }
  const activeProduct = products.find(product => product.id === currentProduct);
  const availableTags = Array.from(new Set([...(activeProduct ? activeProduct.issueTags : products.flatMap(product => product.issueTags)), ...selectedTags])).sort();
  const filterCount = Number(Boolean(currentProduct)) + selectedTags.length + Number(!["all", "open", "APPROVED", "rejected"].includes(currentStatus));
  const sorted = useMemo(() => [...claims].sort((a, b) => (new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()) * (oldestFirst ? -1 : 1)), [claims, oldestFirst]);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const activePage = Math.min(page, pages);
  const pageClaims = sorted.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);
  const pageNumbers = Array.from({ length: pages }, (_, i) => i + 1).filter(n => n === 1 || n === pages || Math.abs(n - activePage) <= 1);
  const activeTab = ["open", "needs_review", "in_review", "INFO_REQUESTED", "SUBMITTED", "UNDER_REVIEW"].includes(currentStatus) ? "open" : currentStatus === "APPROVED" ? "APPROVED" : ["rejected", "REJECTED"].includes(currentStatus) ? "rejected" : "all";

  return <div className={styles.page} data-panel-open={Boolean(selectedClaimId)}>
    <header className={styles.heading}>
      <div><h1>Claims</h1><p>Review and manage warranty claims from your customers.</p></div>
      <form className={styles.search} onSubmit={submitSearch}><Search size={17}/><input type="search" aria-label="Search claims" placeholder="Search claims, customers, or order IDs…" value={searchTerm} onChange={event => setSearchTerm(event.target.value)}/>{searchTerm && <button type="button" aria-label="Clear search" onClick={() => { setSearchTerm(""); changeFilter("search", ""); }}><X size={15}/></button>}</form>
    </header>
    <div className={styles.toolbar}>
      <nav className={styles.tabs} aria-label="Claim status">
        {[{ key: "open", label: "Inbox", count: counts.open }, { key: "APPROVED", label: "Approved", count: counts.approved }, { key: "rejected", label: "Rejected", count: counts.rejected }, { key: "all", label: "All claims", count: counts.all }].map(tab => <button type="button" key={tab.key} aria-current={activeTab === tab.key ? "page" : undefined} onClick={() => changeFilter("status", tab.key)}>{tab.label}<span>{tab.count ?? 0}</span></button>)}
      </nav>
      <button ref={filterButton} type="button" className={styles.filterToggle} aria-expanded={filtersOpen} aria-controls="claim-filters" onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={15}/> Filters{filterCount > 0 && <span>{filterCount}</span>}</button>
    </div>
    <AnimatePresence initial={false}>{filtersOpen && <motion.section id="claim-filters" aria-label="Claim filters" className={styles.filterPanel} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reducedMotion ? 0 : .2 }} onKeyDown={event => { if (event.key === "Escape") { setFiltersOpen(false); filterButton.current?.focus(); } }}>
      <div className={styles.filterInner}>
        <div className={styles.filterFields}>
          <label>Status<select value={currentStatus} onChange={event => changeFilter("status", event.target.value)}>{!statusOptions.some(([value]) => value === currentStatus) && <option value={currentStatus}>{currentStatus.replaceAll("_", " ")}</option>}{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Product<select value={currentProduct} onChange={event => changeFilter("product", event.target.value)}><option value="">All products</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <button type="button" className={styles.reset} onClick={() => { setSearchTerm(""); setSearchParams(new URLSearchParams()); }}>Reset filters</button>
        </div>
        <div className={styles.tagHeading}>Issue tags <span>Select one or more</span></div>
        <div className={styles.tags}>{availableTags.length ? availableTags.map(tag => <button key={tag} type="button" aria-pressed={selectedTags.includes(tag)} onClick={() => toggleTag(tag)}>{selectedTags.includes(tag) && <Check size={13}/>} {tag}</button>) : <p>No issue tags configured for these products.</p>}</div>
      </div>
    </motion.section>}</AnimatePresence>
    <section className={styles.tablePanel} aria-label="Warranty claims" aria-busy={loading}>
      {loading ? <div className={styles.empty} role="status"><span className={styles.loader}/>Loading claims…</div> : error ? <div className={styles.empty} role="alert"><p>{error}</p><button onClick={refreshClaims}>Try again</button></div> : !claims.length ? <div className={styles.empty}><Inbox size={30}/><h2>No claims found</h2><p>{currentSearch || currentProduct || selectedTags.length ? "Try a different search or adjust your filters." : "Claims in this view will appear here."}</p></div> : <div className={styles.tableScroll}><table className={styles.table}>
        <thead><tr><th>Claim ID</th><th>Customer</th><th>Product</th><th>Issue</th><th>Status</th><th aria-sort={oldestFirst ? "ascending" : "descending"}><button type="button" onClick={() => setOldestFirst(value => !value)}>Date {oldestFirst ? <ArrowUp size={13}/> : <ArrowDown size={13}/>}</button></th></tr></thead>
        <tbody>{pageClaims.map(claim => <tr key={claim.id} className={selectedClaimId === claim.id ? styles.selected : undefined} onClick={() => setSelectedClaimId(claim.id)}>
          <td><button type="button" className={styles.claimLink} aria-label={`Open claim ${claim.reference}`} aria-expanded={selectedClaimId === claim.id} aria-controls={selectedClaimId === claim.id ? "claim-detail-panel" : undefined} onClick={() => setSelectedClaimId(claim.id)} title={claim.reference}>{shortClaimReference(claim.reference)}</button></td>
          <td title={claim.customer.email}>{claim.customer.name}</td><td title={claim.unit.serialNumber}>{claim.unit.productModel}</td><td title={claim.issueTitle}>{claim.issueTitle}</td><td><ClaimInboxStatus status={claim.status}/></td><td className={styles.date}>{formatDate(claim.submittedAt)}</td>
        </tr>)}</tbody>
      </table></div>}
      {!loading && !error && <footer className={styles.pagination}><span>{claims.length ? `Showing ${(activePage - 1) * PAGE_SIZE + 1}–${Math.min(activePage * PAGE_SIZE, claims.length)} of ${claims.length} claims` : "0 claims"}</span><nav aria-label="Claims pages"><button disabled={activePage === 1} onClick={() => setPage(activePage - 1)} aria-label="Previous page"><ChevronLeft size={16}/></button>{pageNumbers.map((n, index) => <span key={n}>{index > 0 && n - pageNumbers[index - 1] > 1 && <span className={styles.ellipsis}>…</span>}<button aria-current={n === activePage ? "page" : undefined} onClick={() => setPage(n)} aria-label={`Page ${n}`}>{n}</button></span>)}<button disabled={activePage === pages} onClick={() => setPage(activePage + 1)} aria-label="Next page"><ChevronRight size={16}/></button></nav></footer>}
    </section>
    {createPortal(<AnimatePresence>{selectedClaimId && sessionId && <ClaimQuickView key="claim-panel" sessionId={sessionId} claimId={selectedClaimId} onClose={closeClaim} onUpdated={refreshClaims}/>}</AnimatePresence>, document.body)}
  </div>;
}
export default BrandClaims;
