import { apiFetch } from "@/lib/api-fetch";
import { formatDate } from "@/lib/dates";
import { ProductPhoto } from "@/components/product-photo";
import { ClaimStatusBadge } from "@/components/claim-status-badge";
import { Link } from "react-router-dom";
import { GripHorizontal, Maximize2, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import styles from "./claim-quick-view.module.css";

type Props = { sessionId: string; claimId: string; onClose: () => void };

export function ClaimQuickView({ sessionId, claimId, onClose }: Props) {
  const [claim, setClaim] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "customer" | "timeline">("overview");
  const [error, setError] = useState("");
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const reducedMotion = useReducedMotion();

  function moveTo(x: number, y: number) {
    const bounds = panelRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setPosition({ x: Math.max(8, Math.min(x, window.innerWidth - bounds.width - 8)), y: Math.max(8, Math.min(y, window.innerHeight - bounds.height - 8)) });
  }
  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    if (window.innerWidth <= 900 || event.button !== 0) return;
    const bounds = panelRef.current?.getBoundingClientRect();
    if (!bounds) return;
    dragRef.current = { x: event.clientX, y: event.clientY, left: bounds.left, top: bounds.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const start = dragRef.current;
    if (start) moveTo(start.left + event.clientX - start.x, start.top + event.clientY - start.y);
  }
  function moveWithKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    const delta: Record<string, [number, number]> = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
    const direction = delta[event.key];
    const bounds = panelRef.current?.getBoundingClientRect();
    if (!direction || !bounds) return;
    event.preventDefault();
    moveTo(bounds.left + direction[0], bounds.top + direction[1]);
  }

  useEffect(() => {
    const close = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  useEffect(() => {
    const reset = () => setPosition(null);
    window.addEventListener("resize", reset);
    return () => window.removeEventListener("resize", reset);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setClaim(null);
    setTab("overview");
    apiFetch(`/api/demo/${sessionId}/brand/claims/${claimId}`)
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not load claim."); return data; })
      .then((data) => { if (active) { setClaim(data.claim); setError(""); setLoading(false); } })
      .catch((cause) => { if (active) { setError(cause instanceof Error ? cause.message : "Could not load claim."); setLoading(false); } });
    return () => { active = false; };
  }, [sessionId, claimId]);

  const product = claim?.registration?.unit?.productModel;
  const customer = claim?.registration?.customer;
  return <motion.aside ref={panelRef} className={styles.panel} aria-label="Claim details" style={position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : undefined} initial={reducedMotion ? false : { opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: .98 }} transition={{ duration: reducedMotion ? 0 : .2 }}>
    <header className={styles.header}><strong>Claim details</strong><div className={styles.headerActions}><button type="button" className={styles.dragHandle} aria-label="Move claim panel; use arrow keys or drag" title="Drag to move" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }} onKeyDown={moveWithKeyboard}><GripHorizontal size={19}/></button><Link to={`/demo/${sessionId}/brand/claims/${claimId}`} aria-label="Open full claim" title="Open full claim"><Maximize2 size={17}/></Link><button type="button" onClick={onClose} aria-label="Close claim details"><X size={19}/></button></div></header>
    {loading ? <p className={styles.message}>Loading claim…</p> : error ? <p className={styles.message} role="alert">{error}</p> : claim && <>
      <div className={styles.title}><div><h2>{claim.reference}</h2><span className={styles.submitted}>Submitted {formatDate(claim.submittedAt)}</span></div><ClaimStatusBadge status={claim.status}/></div>
      <nav className={styles.tabs} aria-label="Claim detail sections">{(["overview", "customer", "timeline"] as const).map((item) => <button key={item} type="button" className={tab === item ? styles.active : ""} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</nav>
      <div className={styles.body}>
        {tab === "overview" && <>
          <div className={styles.product}><div className={styles.productImage}>{product?.imageUrl ? <ProductPhoto src={product.imageUrl} alt={product.name}/> : <span className={styles.noPhoto}>No photo</span>}</div><div className={styles.productInfo}><strong>{product?.name}</strong><span>SKU: {product?.sku || "Not set"}</span></div></div>
          <dl className={styles.facts}><div><dt>Customer</dt><dd>{customer?.name}</dd></div><div><dt>Issue</dt><dd>{claim.issueTitle}</dd></div><div><dt>Serial number</dt><dd>{claim.registration.unit.serialNumber}</dd></div></dl>
          {claim.issueTags?.length > 0 && <div className={styles.tags}>{claim.issueTags.map((tag: string) => <span key={tag}>{tag}</span>)}</div>}
          <div className={styles.description}><strong>Description</strong><p>{claim.description}</p></div>
          <div className={styles.description}><strong>Evidence</strong><p>{claim.attachments?.length ? `${claim.attachments.length} attachment${claim.attachments.length === 1 ? "" : "s"} — open full claim to review` : "No photos attached to this claim."}</p></div>
        </>}
        {tab === "customer" && <dl className={styles.facts}><div><dt>Name</dt><dd>{customer?.name}</dd></div><div><dt>Email</dt><dd>{customer?.email}</dd></div><div><dt>Product</dt><dd>{product?.name}</dd></div><div><dt>Coverage ends</dt><dd>{formatDate(claim.registration.coverageEndsOn)}</dd></div></dl>}
        {tab === "timeline" && <ol className={styles.timeline}>{claim.events?.map((event: any) => <li key={event.id}><strong>{event.note || event.toStatus}</strong><time>{formatDate(event.createdAt)}</time></li>)}</ol>}
      </div>
      <footer className={styles.footer}>{claim.status === "UNDER_REVIEW" && <div className={styles.decisions}><Link to={`/demo/${sessionId}/brand/claims/${claimId}?decision=approve`} className={styles.primary}>Approve</Link><Link to={`/demo/${sessionId}/brand/claims/${claimId}?decision=request_info`}>Request info</Link><Link to={`/demo/${sessionId}/brand/claims/${claimId}?decision=reject`}>Reject</Link></div>}<Link to={`/demo/${sessionId}/brand/claims/${claimId}`} className={styles.fullClaim}><Maximize2 size={15}/> {claim.status === "SUBMITTED" ? "Open claim and start review" : "Open full claim"}</Link></footer>
    </>}
  </motion.aside>;
}
