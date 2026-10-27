import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Clock3, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { isUuid, requireBrand } from "@/lib/brand";
import { daysRemaining, formatDate, isCoverageActive } from "@/lib/dates";
import { claimStatusLabels } from "@/lib/claim-status";
import { BrandClaimActions } from "@/components/brand-claim-actions";
import styles from "@/components/brand-claims.module.css";

function attachmentUrl(key: string) {
  if (key.startsWith("/") && !key.startsWith("//")) return key;
  try { return new URL(key).protocol === "https:" ? key : null; } catch { return null; }
}

export default async function BrandClaimDetailPage({ params }: { params: Promise<{ sessionId: string; claimId: string }> }) {
  const { sessionId, claimId } = await params;
  const brand = await requireBrand(sessionId);
  if (!isUuid(claimId)) notFound();
  const claim = await db.warrantyClaim.findFirst({
    where: { id: claimId, registration: { customer: { demoSessionId: sessionId }, unit: { brandId: brand.id } } },
    include: {
      registration: { include: { customer: true, unit: { include: { productModel: true, purchaseOrder: true } } } },
      events: { orderBy: { createdAt: "asc" } },
      messages: { orderBy: { createdAt: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!claim) notFound();
  const { registration } = claim;
  const { unit, customer } = registration;
  const active = isCoverageActive(registration.coverageEndsOn);

  return <div className={styles.page}>
    <Link className={styles.backLink} href={`/demo/${sessionId}/brand/claims`}><ArrowLeft size={14} />All claims</Link>
    <header className={styles.pageHeader}><div><h1>{claim.reference}</h1><p>Submitted {formatDate(claim.submittedAt)} · {customer.name}</p></div><div className={styles.headerActions}><span className={styles.badge} data-status={claim.status}>{claimStatusLabels[claim.status]}</span><Link className={styles.secondaryButton} href={`/demo/${sessionId}/customer/claims/${claimId}`} target="_blank" rel="noreferrer">Customer view<ArrowUpRight size={14} /></Link></div></header>
    <div className={styles.detailGrid}><div className={styles.mainColumn}>
      <section className={styles.panel}><div className={styles.panelHeading}><h2>Reported issue</h2><span className={styles.subtleLabel}>{unit.productModel.name}</span></div><h3 className={styles.issueTitle}>{claim.issueTitle}</h3><p className={styles.description}>{claim.description}</p>
        {claim.attachments.length > 0 ? <div className={styles.attachments}>{claim.attachments.map((attachment, i) => { const url = attachmentUrl(attachment.fileKey); return url ? <a href={url} key={attachment.id} target="_blank" rel="noreferrer" aria-label={`Open attachment ${i + 1}`}><img src={url} alt={`Customer evidence ${i + 1}`} /></a> : <span key={attachment.id} className={styles.muted}>Attachment {i + 1} is unavailable.</span>; })}</div> : <p className={styles.hint}>No photos attached.</p>}
      </section>
      <section className={styles.panel}><div className={styles.panelHeading}><h2>Product & warranty</h2><ShieldCheck size={18} className={styles.subtleIcon} /></div><div className={styles.warrantySummary}><span className={`${styles.badge} ${active ? styles.covered : styles.neutral}`}>{active ? "Under warranty" : "Warranty expired"}</span><strong>{daysRemaining(registration.coverageEndsOn)} <span>days remaining</span></strong></div><dl className={styles.detailList}><div><dt>Product</dt><dd><Link href={`/demo/${sessionId}/brand/products/${unit.productModelId}`}>{unit.productModel.name}<ArrowUpRight size={12} /></Link></dd></div><div><dt>Stamped unit ID</dt><dd>{unit.serialNumber}</dd></div><div><dt>Order reference</dt><dd>{unit.purchaseOrder!.orderNumber}</dd></div><div><dt>Delivered</dt><dd>{unit.purchaseOrder!.deliveredOn ? formatDate(unit.purchaseOrder!.deliveredOn) : "Awaiting delivery"}</dd></div><div><dt>Coverage starts</dt><dd>{formatDate(registration.coverageStartsOn)}</dd></div><div><dt>Coverage ends</dt><dd>{formatDate(registration.coverageEndsOn)}</dd></div>{claim.resolutionMethod && <div><dt>Resolution</dt><dd>{claim.resolutionMethod === "REPAIR" ? "Repair" : "Replacement"}</dd></div>}</dl></section>
      {claim.messages.length > 0 && <section className={styles.panel}><div className={styles.panelHeading}><h2>Conversation</h2></div><div className={styles.messages}>{claim.messages.map((message) => <article key={message.id} className={styles.message} data-author={message.author}><div><strong>{message.author === "CUSTOMER" ? customer.name : message.author === "BRAND" ? brand.name : "Vouch"}</strong><time>{formatDate(message.createdAt)}</time></div><p>{message.body}</p></article>)}</div></section>}
      <section className={styles.panel}><div className={styles.panelHeading}><h2>Claim history</h2><Clock3 size={17} className={styles.subtleIcon} /></div><ol className={styles.history}>{claim.events.map((event) => <li key={event.id}><span className={styles.eventDot} /><div><strong>{event.toStatus === "SUBMITTED" ? "Claim submitted" : claimStatusLabels[event.toStatus]}</strong>{event.note && <p>{event.note}</p>}<time>{formatDate(event.createdAt)} · {event.actor === "CUSTOMER" ? customer.name : event.actor === "BRAND" ? brand.name : "System"}</time></div></li>)}</ol></section>
    </div><aside className={styles.sideColumn}>
      <BrandClaimActions sessionId={sessionId} claimId={claimId} status={claim.status} />
      <section className={styles.panel}><div className={styles.panelHeading}><h2>Customer</h2></div><div className={styles.customer}><span className={styles.avatar}>{customer.name.charAt(0).toUpperCase()}</span><div><strong>{customer.name}</strong><span>{customer.email}</span></div></div><p className={styles.hint}>Contact details are part of the demo record. Updates are shown on the customer’s claim page.</p></section>
    </aside></div>
  </div>;
}
