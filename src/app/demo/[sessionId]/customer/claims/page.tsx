import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { CustomerNav } from "@/components/customer-nav";
import { ProductVisual } from "@/components/product-visual";
import styles from "@/components/customer-product.module.css";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/brand";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function CustomerClaimsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) notFound();
  const customer = await db.customer.findFirst({ where: { demoSessionId: sessionId } });
  if (!customer) notFound();
  const claims = await db.warrantyClaim.findMany({ where: { registration: { customerId: customer.id, unit: { brand: { demoSessionId: sessionId } } } }, include: { registration: { include: { unit: { include: { productModel: true, brand: true } } } } }, orderBy: { submittedAt: "desc" } });
  return <><CustomerNav sessionId={sessionId} customerName={customer.name}/><main className="page-wrap content"><div className="section-head" style={{ marginTop: 36 }}><div><Link className="muted" href={`/demo/${sessionId}/customer`} style={{ fontSize: 12 }}><ArrowLeft size={13} style={{ verticalAlign: "middle" }}/> My products</Link><h1 style={{ margin: "14px 0 8px", fontSize: 31, letterSpacing: -1 }}>Your claims.</h1><p>Every update stays available at the same tracking link.</p></div></div>
    {claims.length ? <div className={styles.claimList}>{claims.map((claim) => <Link className={styles.claimItem} key={claim.id} href={`/demo/${sessionId}/customer/claims/${claim.id}`}><div className={styles.compactImage}><ProductVisual imageUrl={claim.registration.unit.productModel.imageUrl} name={claim.registration.unit.productModel.name} kind={claim.registration.unit.productModel.slug.includes("charge") ? "charger" : "headphones"}/></div><div><h2>{claim.issueTitle}</h2><p>{claim.registration.unit.productModel.name} · {claim.registration.unit.brand.name}</p><strong className={styles.claimReference}>{claim.reference}</strong></div><span className={`status-pill ${claim.status.toLowerCase()}`}>{claim.status.replaceAll("_", " ")}</span><span className="muted" style={{ fontSize: 11 }}>{formatDate(claim.submittedAt)}</span><ChevronRight size={16}/></Link>)}</div> : <div className="blank-state">No claims yet. Start from an active product warranty card when you need support.</div>}
  </main></>;
}
