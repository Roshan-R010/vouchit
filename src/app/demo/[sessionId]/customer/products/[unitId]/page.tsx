import Link from "next/link";
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { CustomerNav } from "@/components/customer-nav";
import { ProductVisual } from "@/components/product-visual";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/brand";
import { daysRemaining, formatDate, isCoverageActive } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function CustomerProductPage({ params, searchParams }: { params: Promise<{ sessionId: string; unitId: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { sessionId, unitId } = await params;
  const query = await searchParams;
  if (!isUuid(sessionId) || !isUuid(unitId)) notFound();
  const registration = await db.warrantyRegistration.findFirst({ where: { unitId, customer: { demoSessionId: sessionId }, unit: { brand: { demoSessionId: sessionId } } }, include: { customer: true, claim: true, unit: { include: { brand: true, productModel: true, purchaseOrder: true } } } });
  if (!registration) notFound();
  const active = isCoverageActive(registration.coverageEndsOn);
  return <><CustomerNav sessionId={sessionId} customerName={registration.customer.name}/><main className="page-wrap content"><div className="form-shell">
    <header className="form-header"><Link className="muted" href={`/demo/${sessionId}/customer`} style={{ fontSize: 12 }}><ArrowLeft size={13} style={{ verticalAlign: "middle" }}/> My products</Link>{query.notice && <div className="notice">{query.notice === "registered" ? "Warranty registered successfully." : "This unit was already registered."}</div>}<div style={{ display: "grid", gridTemplateColumns: "150px 1fr", alignItems: "center", gap: 24, marginTop: 22 }}><ProductVisual imageUrl={registration.unit.productModel.imageUrl} name={registration.unit.productModel.name} kind={registration.unit.productModel.slug.includes("charge") ? "charger" : "headphones"}/><div><div className="eyebrow">{registration.unit.brand.name}</div><h1>{registration.unit.productModel.name}</h1><span className={active ? "badge" : "badge expired"}>{active ? "Under warranty" : "Expired"}</span><div className="warranty-remaining"><strong>{daysRemaining(registration.coverageEndsOn)}</strong><span>days remaining</span></div></div></div></header>
    <div className="form-body"><div className="info-row"><span>Stamped unit ID</span><span>{registration.unit.serialNumber}</span></div><div className="info-row"><span>Order reference</span><span>{registration.unit.purchaseOrder!.orderNumber}</span></div><div className="info-row"><span>Delivered</span><span>{registration.unit.purchaseOrder!.deliveredOn ? formatDate(registration.unit.purchaseOrder!.deliveredOn) : "—"}</span></div><div className="info-row"><span>Coverage</span><span>{formatDate(registration.coverageStartsOn)} – {formatDate(registration.coverageEndsOn)}</span></div><div className="info-row"><span>Warranty policy</span><span>{registration.unit.productModel.warrantyMonths} months from delivery</span></div>
      {registration.claim ? <Link className="action" style={{ marginTop: 22 }} href={`/demo/${sessionId}/customer/claims/${registration.claim.id}`}><ShieldCheck size={15}/> View claim</Link> : active && <Link className="action" style={{ marginTop: 22 }} href={`/demo/${sessionId}/customer/claims/new?unitId=${unitId}`}><ShieldCheck size={15}/> Raise a claim</Link>}
      <h2 style={{ margin: "34px 0 12px", fontSize: 18 }}>Claim</h2>{registration.claim ? <div className="claims-list"><Link className="claim-row" style={{ gridTemplateColumns: "1fr 1.4fr 120px 22px" }} href={`/demo/${sessionId}/customer/claims/${registration.claim.id}`}><strong>{registration.claim.reference}</strong><span>{registration.claim.issueTitle}</span><span className={`status-pill ${registration.claim.status.toLowerCase()}`}>{registration.claim.status.replaceAll("_", " ")}</span><FileText size={14}/></Link></div> : <div className="blank-state">No claim for this unit.</div>}
    </div>
  </div></main></>;
}
