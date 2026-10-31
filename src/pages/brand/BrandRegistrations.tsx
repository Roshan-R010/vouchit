import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Package, Search, X } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";
import { dateOnly, daysRemaining, formatDate, isCoverageActive } from "@/lib/dates";
import { shortClaimReference } from "@/lib/claim-reference";
import { ProductPhoto } from "@/components/product-photo";
import { Select } from "@/components/select";
import styles from "./brand-registrations.module.css";

type Registration = {
  id: string; active: boolean; registeredAt: string; coverageStartsOn: string; coverageEndsOn: string;
  customer: { name: string; email: string };
  unit: { serialNumber: string; productModel: { id: string; name: string; imageUrl: string | null }; purchaseOrder: { orderNumber: string } | null };
  claim: { id: string; reference: string; status: string } | null;
};
type Product = { id: string; name: string };
type LedgerResponse = { registrations: Registration[]; products: Product[]; total: number; page: number; pageSize: number };

function coverageState(registration: Registration): "active" | "expiring" | "expired" | "ended" {
  if (registration.active === false) return "ended";
  if (!isCoverageActive(registration.coverageEndsOn)) return "expired";
  return dateOnly(registration.coverageStartsOn) <= dateOnly(new Date()) && daysRemaining(registration.coverageEndsOn) <= 30 ? "expiring" : "active";
}

function ClaimLink({ registration, sessionId }: { registration: Registration; sessionId: string }) {
  if (!registration.claim) return null;
  return <Link to={`/demo/${sessionId}/brand/claims/${registration.claim.id}`} className={styles.claimLink} onClick={event => event.stopPropagation()}>View claim</Link>;
}

export function BrandRegistrations() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const product = searchParams.get("product") || "";
  const filter = searchParams.get("filter") || "";
  const status = searchParams.get("status") || (filter === "expiring" ? "expiring" : "");
  const search = searchParams.get("search") || "";
  const requestedPage = Math.max(1, Number(searchParams.get("page")) || 1);
  const [searchInput, setSearchInput] = useState(search);
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Registration | null>(null);
  const [revision, setRevision] = useState(0);
  const closeButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);
  const selectedTrigger = useRef<HTMLElement | null>(null);

  function openDetails(registration: Registration, trigger: HTMLElement) { selectedTrigger.current = trigger; setSelected(registration); }
  function closeDetails() { setSelected(null); window.requestAnimationFrame(() => selectedTrigger.current?.focus()); }

  useEffect(() => { setSearchInput(search); }, [search]);
  useEffect(() => {
    const value = searchInput.trim();
    if (value === search) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set("search", value); else next.delete("search");
      next.delete("page");
      setSearchParams(next, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, search, searchParams, setSearchParams]);
  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    setLoading(true); setError("");
    const query = new URLSearchParams();
    if (product) query.set("product", product);
    if (status) query.set("status", status);
    if (search) query.set("search", search);
    if (filter === "missing_details") query.set("filter", filter);
    query.set("page", String(requestedPage));
    apiFetch(`/api/demo/${sessionId}/brand/registrations?${query}`, { cache: "no-store" }).then(readApiResponse)
      .then((response: LedgerResponse) => { if (active) setData(response); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Could not load registrations."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionId, product, status, search, filter, requestedPage, revision]);
  useEffect(() => {
    if (!selected) return;
    closeButton.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") { closeDetails(); return; }
      if (event.key !== "Tab") return;
      const focusable = Array.from(drawer.current?.querySelectorAll<HTMLElement>("button:not([disabled]),a[href]") || []);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  function updateFilter(key: "product" | "status", value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key === "status" && filter === "expiring") next.delete("filter");
    next.delete("page");
    setSearchParams(next);
  }
  function resetFilters() { setSearchInput(""); setSearchParams({}); }
  function changePage(value: number) { const next = new URLSearchParams(searchParams); next.set("page", String(value)); setSearchParams(next); }
  function openWithKeyboard(event: KeyboardEvent<HTMLTableRowElement>, registration: Registration) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openDetails(registration, event.currentTarget); }
  }

  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 10;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pages);
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, total);
  const hasFilters = Boolean(product || status || search || filter);
  const emptyTitle = search ? "No matching registrations" : product ? "No registrations for this product" : hasFilters ? "No registrations found" : "No registered products yet";
  const emptyText = search ? "Try searching using another unit ID, order ID, customer name, or email." : product ? "Try another product or clear your filters." : hasFilters ? "No registered units match your selected filters." : "Customer warranty registrations will appear here.";

  return <div className={styles.page}>
    <header className={styles.heading}>
      <div className={styles.intro}><span className={styles.eyebrow}>Warranty ledger</span><h1>Warranty Registrations</h1><p>Track registered units and verify customer warranty coverage.</p></div>
      <div className={styles.controls}>
        <label className={styles.search}><Search size={19} aria-hidden="true"/><input type="search" aria-label="Search registrations" placeholder="Search by unit ID, order ID, customer or email..." value={searchInput} onChange={event => setSearchInput(event.target.value)}/>{searchInput && <button type="button" aria-label="Clear search" onClick={() => setSearchInput("")}><X size={15}/></button>}</label>
        <div className={styles.filters}><label><Select aria-label="Product" value={product} onChange={event => updateFilter("product", event.target.value)}><option value="">All products</option>{data?.products.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label><label><Select aria-label="Warranty status" value={status} onChange={event => updateFilter("status", event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="expiring">Expiring soon</option><option value="expired">Expired</option><option value="ended">Ended after return</option></Select></label></div>
      </div>
    </header>
    {filter === "missing_details" && <div className={styles.filterNote}>Showing registrations missing details. <button type="button" onClick={resetFilters}>Show all</button></div>}
    <section className={styles.card} aria-label="Warranty registrations">
      <div className={styles.cardHeader}><h2>{loading || error ? "Registrations" : `${total.toLocaleString()} ${total === 1 ? "registration" : "registrations"}`}</h2><p>Verified coverage windows associated with registered customer products.</p></div>
      {error ? <div className={styles.message} role="alert"><strong>Could not load registrations</strong><p>{error}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Try again</button></div>
      : loading ? <div className={styles.skeleton} aria-label="Loading registrations">{Array.from({ length: 3 }, (_, index) => <div key={index}/>)}</div>
      : !data?.registrations.length ? <div className={styles.message}><strong>{emptyTitle}</strong><p>{emptyText}</p>{hasFilters && <button type="button" onClick={resetFilters}>Clear filters</button>}</div>
      : <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Unit / Product</th><th>Customer</th><th>Coverage</th><th>Claim</th><th>Status</th><th aria-label="Details"/></tr></thead><tbody>{data.registrations.map(registration => {
        const coverage = coverageState(registration);
        const remaining = daysRemaining(registration.coverageEndsOn);
        return <tr key={registration.id} tabIndex={0} aria-label={`View registration for ${registration.unit.serialNumber}`} onClick={event => openDetails(registration, event.currentTarget)} onKeyDown={event => openWithKeyboard(event, registration)}>
          <td><div className={styles.unitCell}><div className={styles.photo}>{registration.unit.productModel.imageUrl ? <ProductPhoto src={registration.unit.productModel.imageUrl} alt=""/> : <Package size={23} strokeWidth={1.5}/>}</div><div className={styles.cellStack}><strong title={registration.unit.serialNumber}>{registration.unit.serialNumber}</strong><span title={registration.unit.productModel.name}>{registration.unit.productModel.name}</span><small title={registration.unit.purchaseOrder?.orderNumber || ""}>Order: {registration.unit.purchaseOrder?.orderNumber || "Not recorded"}</small></div></div></td>
          <td><div className={styles.cellStack}><strong title={registration.customer.name}>{registration.customer.name || "Name missing"}</strong><small title={registration.customer.email}>{registration.customer.email || "Email missing"}</small></div></td>
          <td><div className={styles.cellStack}><span className={`${styles.coverageBadge} ${styles[coverage] || styles.expired}`}><Check size={12}/>{coverage === "ended" ? "Warranty ended" : coverage === "expired" ? "Coverage expired" : coverage === "expiring" ? "Expiring soon" : "Active coverage"}</span><span className={styles.dates}>{formatDate(registration.coverageStartsOn)} → {formatDate(registration.coverageEndsOn)}</span><small>{coverage === "ended" ? "Registration deactivated" : coverage === "expired" ? "Coverage has ended" : `${remaining} ${remaining === 1 ? "day" : "days"} remaining`}</small></div></td>
          <td>{registration.claim ? <div className={styles.cellStack}><strong>1 claim submitted</strong><small title={registration.claim.reference}>{shortClaimReference(registration.claim.reference)}</small><ClaimLink registration={registration} sessionId={sessionId!}/></div> : <div className={styles.cellStack}><strong>No claims</strong><small>No claims submitted</small></div>}</td>
          <td><span className={`${styles.statusBadge} ${styles[coverage] || styles.expired}`}>{coverage === "ended" ? "Ended" : coverage === "expired" ? "Expired" : coverage === "expiring" ? "Expiring" : "Active"}</span></td>
          <td><button type="button" className={styles.rowArrow} aria-label={`View details for ${registration.unit.serialNumber}`} onClick={event => { event.stopPropagation(); openDetails(registration, event.currentTarget); }}><ChevronRight size={20}/></button></td>
        </tr>;
      })}</tbody></table></div>}
      <footer className={styles.footer}><span>{loading ? "Loading registrations..." : error ? "Unable to load registrations" : `Showing ${first}–${last} of ${total.toLocaleString()} registrations`}</span><nav aria-label="Registration pages"><button type="button" aria-label="Previous page" disabled={page <= 1 || loading || Boolean(error)} onClick={() => changePage(page - 1)}><ChevronLeft size={18}/></button><span aria-current="page">{page}</span><button type="button" aria-label="Next page" disabled={page >= pages || loading || Boolean(error)} onClick={() => changePage(page + 1)}><ChevronRight size={18}/></button></nav></footer>
    </section>
    {selected && <div className={styles.drawerLayer}><button type="button" className={styles.backdrop} aria-label="Close registration details" onClick={closeDetails}/><aside ref={drawer} className={styles.drawer} role="dialog" aria-modal="true" aria-label={`Registration details for ${selected.unit.serialNumber}`}><header><div><span className={styles.eyebrow}>Registration details</span><h2>{selected.unit.serialNumber}</h2><p>{selected.unit.productModel.name}</p></div><button ref={closeButton} type="button" aria-label="Close details" onClick={closeDetails}><X size={20}/></button></header><div className={styles.drawerBody}><div className={styles.detailSection}><h3>Customer</h3><dl><div><dt>Name</dt><dd>{selected.customer.name || "Not provided"}</dd></div><div><dt>Email</dt><dd>{selected.customer.email || "Not provided"}</dd></div></dl></div><div className={styles.detailSection}><h3>Unit and order</h3><dl><div><dt>Product</dt><dd>{selected.unit.productModel.name}</dd></div><div><dt>Stamped unit ID</dt><dd>{selected.unit.serialNumber}</dd></div><div><dt>Order ID</dt><dd>{selected.unit.purchaseOrder?.orderNumber || "Not recorded"}</dd></div></dl></div><div className={styles.detailSection}><h3>Coverage</h3><dl><div><dt>Registered</dt><dd>{formatDate(selected.registeredAt)}</dd></div><div><dt>Starts</dt><dd>{formatDate(selected.coverageStartsOn)}</dd></div><div><dt>Ends</dt><dd>{formatDate(selected.coverageEndsOn)}</dd></div><div><dt>Status</dt><dd>{coverageState(selected) === "ended" ? "Ended after return" : coverageState(selected) === "expired" ? "Expired" : coverageState(selected) === "expiring" ? "Expiring soon" : "Active"}</dd></div></dl></div><div className={styles.detailSection}><h3>Claim</h3>{selected.claim ? <><p><strong>{selected.claim.reference}</strong> · {selected.claim.status.replaceAll("_", " ").toLowerCase()}</p><ClaimLink registration={selected} sessionId={sessionId!}/></> : <p>No claim submitted for this unit.</p>}</div></div></aside></div>}
  </div>;
}

export default BrandRegistrations;
