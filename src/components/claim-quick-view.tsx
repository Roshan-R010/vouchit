import { Select } from "@/components/select";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";
import { formatDate } from "@/lib/dates";
import { shortClaimReference } from "@/lib/claim-reference";
import { ProductPhoto } from "@/components/product-photo";
import { ClaimInboxStatus, inboxStatusLabels } from "./claim-inbox-status";
import { ClaimEvidence } from "@/components/claim-evidence";
import { Link } from "react-router-dom";
import { Check, ChevronDown, Clock3, ExternalLink, FileText, MapPin, Maximize2, MessageSquare, Package, Paperclip, RefreshCw, UserRound, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./claim-quick-view.module.css";

type Props = { sessionId: string; claimId: string; onClose: () => void; onUpdated?: () => void };
type Decision = "approve" | "reject" | "request_info" | "resolve" | "request_address";
const actionLabels: Record<Decision, string> = { approve: "Approve claim", reject: "Reject claim", request_info: "Request information", resolve: "Mark as resolved", request_address: "Request customer address" };
function timestamp(value: string) {
  return `${formatDate(value)} · ${new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(value))}`;
}

export function ClaimQuickView(props: Props) {
  const reducedMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !event.defaultPrevented) props.onClose(); };
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("keydown", close); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [props.onClose]);
  return <motion.aside id="claim-detail-panel" className={styles.panel} role="dialog" aria-label="Claim details" aria-modal="false"
    initial={reducedMotion ? false : { x: "100%", opacity: .7 }} animate={{ x: 0, opacity: 1 }} exit={{ x: reducedMotion ? 0 : "100%", opacity: 0 }} transition={{ duration: reducedMotion ? 0 : .32, ease: [.22, 1, .36, 1] }}>
    <ClaimPanelContent key={props.claimId} {...props} closeRef={closeRef}/>
  </motion.aside>;
}

function ClaimPanelContent({ sessionId, claimId, onClose, onUpdated, closeRef }: Props & { closeRef: React.RefObject<HTMLButtonElement | null> }) {
  const [claim, setClaim] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [action, setAction] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [resolutionMethod, setResolutionMethod] = useState("REPAIR");
  const [submitting, setSubmitting] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const alive = useRef(true);
  const requestVersion = useRef(0);
  const fullPath = `/demo/${sessionId}/brand/claims/${claimId}`;
  const endpoint = `/api/demo/${sessionId}/brand/claims/${claimId}`;
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setRefreshing(true); setLoadError("");
    try {
      const data = await apiFetch(endpoint, { cache: "no-store" }).then(readApiResponse);
      if (alive.current && version === requestVersion.current) { setClaim(data.claim); setResolutionMethod(data.claim.resolutionMethod || "REPAIR"); }
    } catch (cause) {
      if (alive.current && version === requestVersion.current) setLoadError(cause instanceof Error ? cause.message : "Could not load claim.");
    } finally {
      if (alive.current && version === requestVersion.current) { setLoading(false); setRefreshing(false); }
    }
  }, [endpoint]);
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; }; }, [load]);

  function chooseAction(value: Decision) { setAction(value); setNote(""); setError(""); setNotice(""); }
  async function runAction(decision: Decision | "review") {
    if (submitting) return;
    setSubmitting(true); setError(""); setNotice("");
    try {
      const data = await apiFetch(`${endpoint}/${decision === "request_address" ? "request-address" : "action"}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note.trim(), resolutionMethod: ["approve", "resolve", "request_address"].includes(decision) ? resolutionMethod : undefined }),
      }).then(readApiResponse);
      onUpdated?.();
      if (!alive.current) return;
      setAction(null); setNote(""); setNotice(data.message || "Address requested from the customer.");
      await load();
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "Could not update claim."); }
    finally { if (alive.current) setSubmitting(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); if (action) void runAction(action); }

  const unit = claim?.registration?.unit;
  const product = unit?.productModel;
  const customer = claim?.registration?.customer;
  const address = claim?.addressRequest;
  const events: any[] = claim?.events || [];
  const shownEvents = showAllEvents ? events : events.slice(-3);
  const disabled = submitting || refreshing || Boolean(loadError);
  return <>
    <header className={styles.header}>
      <div className={styles.title}><div><h2 title={claim?.reference} aria-label={claim?.reference}>{claim ? shortClaimReference(claim.reference) : "Claim details"}</h2>{claim && <ClaimInboxStatus status={claim.status}/>}</div><p>{claim ? `Submitted ${timestamp(claim.submittedAt)}` : "Warranty claim"}</p></div>
      <div className={styles.headerActions}><button type="button" onClick={() => void load()} disabled={submitting || refreshing} aria-label="Refresh claim" title="Refresh claim"><RefreshCw size={16} className={refreshing ? styles.spin : undefined}/></button><Link to={fullPath} aria-label="Open full claim" title="Open full claim"><Maximize2 size={16}/></Link><button ref={closeRef} type="button" onClick={onClose} aria-label="Close claim details"><X size={20}/></button></div>
    </header>
    <div className={styles.scrollBody}>
      {loading ? <p className={styles.loading} role="status">Loading claim…</p> : <>
        {loadError && <div className={styles.error} role="alert">{loadError}<button onClick={() => void load()}>Try again</button></div>}
        {claim && <>
          <div className={styles.overview}>
            <section className={styles.infoRow}><UserRound size={17}/><div><span className={styles.label}>Customer</span><strong>{customer?.name}</strong><a className={styles.muted} href={`mailto:${customer?.email}`}>{customer?.email}</a></div></section>
            <section className={styles.infoRow}><Package size={17}/><div className={styles.productInfo}><span className={styles.label}>Product</span><strong>{product?.name}</strong><p className={styles.muted}>Unit ID: {unit.serialNumber}{unit.purchaseOrder?.orderNumber && <> <span className={styles.dot}>·</span> Order ID: {unit.purchaseOrder.orderNumber}</>}</p><span className={styles.coverage}>Coverage ends {formatDate(claim.registration.coverageEndsOn)}</span></div><Link className={styles.productImage} to={`/demo/${sessionId}/brand/products/${unit.productModelId}`} aria-label={`Open ${product?.name} product`}>{product?.imageUrl ? <ProductPhoto src={product.imageUrl} alt={product.name}/> : <Package size={28}/>}</Link></section>
            <section className={styles.infoRow}><FileText size={17}/><div><span className={styles.label}>Issue description</span><strong className={styles.issueTitle}>{claim.issueTitle}</strong><p className={styles.description}>{claim.description}</p>{claim.issueTags?.length > 0 && <div className={styles.tags}>{claim.issueTags.map((tag: string) => <span key={tag}>{tag}</span>)}</div>}</div></section>
            <section className={styles.infoRow}><Paperclip size={17}/><div className={styles.evidence}><span className={styles.sectionLabel}>Attachments ({claim.attachments?.length || 0})</span><ClaimEvidence sessionId={sessionId} claimId={claimId} attachments={claim.attachments || []} compact/></div></section>

            <div className={styles.actions} aria-label="Claim actions">
              {claim.status === "SUBMITTED" && <button className={styles.primary} disabled={disabled} onClick={() => void runAction("review")}><FileText size={15}/>{submitting ? "Starting review…" : "Start review"}</button>}
              {claim.status === "UNDER_REVIEW" && <><button className={styles.primary} disabled={disabled} onClick={() => chooseAction("approve")}><Check size={16}/> Approve</button><button disabled={disabled} onClick={() => chooseAction("request_info")}><MessageSquare size={15}/> Request info</button><button disabled={disabled} onClick={() => chooseAction("reject")}><X size={16}/> Reject</button></>}
              {claim.status === "APPROVED" && <>{!address ? <button className={styles.primary} disabled={disabled} onClick={() => chooseAction("request_address")}><MapPin size={15}/> Request address</button> : <button className={styles.primary} disabled={disabled || !address.receivedAt} onClick={() => chooseAction("resolve")}><Check size={16}/> Mark as resolved</button>}</>}
            </div>
            {claim.status === "INFO_REQUESTED" && <p className={styles.stateNote}>Waiting for the customer’s reply. Refresh to check for updates.</p>}
            {claim.status === "APPROVED" && address && !address.receivedAt && <p className={styles.stateNote}>Waiting for the customer’s address before completing the {claim.resolutionMethod === "REPLACEMENT" ? "replacement" : "repair"}.</p>}
            {claim.status === "RESOLVED" && <p className={styles.completed}><Check size={15}/> This claim is resolved.</p>}
            {claim.status === "REJECTED" && <p className={styles.stateNote}>This claim is closed. The decision is recorded in the activity timeline.</p>}

            {action && <form className={styles.actionForm} onSubmit={submit}>
              <h3>{actionLabels[action]}</h3>
              {["approve", "resolve", "request_address"].includes(action) && <label>Resolution method<Select value={resolutionMethod} disabled={submitting || (action === "resolve" && Boolean(claim.resolutionMethod))} onChange={event => setResolutionMethod(event.target.value)}><option value="REPAIR">Repair</option><option value="REPLACEMENT">Replacement</option></Select></label>}
              {action !== "request_address" && <label>{action === "request_info" ? "What information do you need?" : action === "reject" ? "Reason for rejection" : action === "resolve" ? "Repair or replacement outcome" : "Note to record (optional)"}<textarea autoFocus rows={3} maxLength={2000} required={["request_info", "reject", "resolve"].includes(action)} disabled={submitting} value={note} onChange={event => setNote(event.target.value)}/></label>}
              {action === "approve" && <p>The customer will be asked to provide their address.</p>}
              {action === "request_address" && <p>The customer can submit their address from their claim page.</p>}
              <div><button type="button" onClick={() => setAction(null)} disabled={submitting}>Cancel</button><button className={action === "reject" ? styles.danger : styles.primary} disabled={disabled} type="submit">{submitting ? "Saving…" : actionLabels[action]}</button></div>
            </form>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            {notice && <p className={styles.success} role="status"><Check size={15}/>{notice}</p>}

            <details className={styles.address}>
              <summary><MapPin size={16}/><span>Address details</span><small>{address?.receivedAt ? "Received" : address ? "Awaiting customer" : "Not requested"}</small><ChevronDown size={16}/></summary>
              <div>{address?.receivedAt ? <address><strong>{address.recipient}</strong><span>{address.line1}</span>{address.line2 && <span>{address.line2}</span>}<span>{[address.city, address.region, address.postalCode].filter(Boolean).join(", ")}</span><span>{address.country}</span>{address.phone && <a href={`tel:${address.phone}`}>{address.phone}</a>}</address> : <p>{address ? "The address has been requested. Refresh this claim after the customer submits it." : "An address is requested when a claim is approved for repair or replacement."}</p>}</div>
            </details>
            {claim.messages?.length > 0 && <details className={styles.conversation}><summary><MessageSquare size={16}/><span>Conversation</span><small>{claim.messages.length} messages</small><ChevronDown size={16}/></summary><div>{claim.messages.map((message: any) => <article key={message.id}><header><strong>{message.author === "CUSTOMER" ? customer.name : "Brand team"}</strong><time>{timestamp(message.createdAt)}</time></header><p>{message.body}</p></article>)}</div></details>}
          </div>

          <section className={styles.activity} aria-label="Activity timeline"><header><h3><Clock3 size={17}/> Activity timeline</h3>{events.length > 3 && <button onClick={() => setShowAllEvents(value => !value)}>{showAllEvents ? "Show recent" : "View all"}</button>}</header>
            {!events.length ? <p className={styles.stateNote}>No activity recorded yet.</p> : <ol>{shownEvents.map(event => <li key={event.id}><span className={styles.avatar} data-actor={event.actor}>{event.actor === "CUSTOMER" ? customer.name.slice(0, 2).toUpperCase() : event.actor === "BRAND" ? "BT" : "V"}</span><div><div className={styles.eventHeading}><strong>{event.actor === "CUSTOMER" ? customer.name : event.actor === "BRAND" ? "Brand team" : "Vouch"}</strong><time>{timestamp(event.createdAt)}</time></div><p>{event.note || inboxStatusLabels[event.toStatus] || event.toStatus}</p></div></li>)}</ol>}
          </section>
        </>}
      </>}
      <footer className={styles.footer}><Link to={fullPath}>Open full claim <ExternalLink size={14}/></Link></footer>
    </div>
  </>;
}
