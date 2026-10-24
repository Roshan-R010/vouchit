import Link from "next/link";
import { ArrowRight, ChevronRight, PackagePlus } from "lucide-react";
import { notFound } from "next/navigation";
import { CustomerNav } from "@/components/customer-nav";
import { ProductVisual } from "@/components/product-visual";
import { db } from "@/lib/db";
import { daysRemaining, formatDate, isCoverageActive } from "@/lib/dates";
import { isUuid } from "@/lib/brand";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ sessionId: string }>; searchParams: Promise<{ notice?: string; error?: string; filter?: string }> };

export default async function CustomerDashboard({ params, searchParams }: Props) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) notFound();
  const query = await searchParams;
  const customer = await db.customer.findFirst({ where: { demoSessionId: sessionId } });
  if (!customer) return <main className="page-wrap"><div className="blank-state" style={{ marginTop: 60 }}>This demo session was not found. <Link href="/demo">Start a new demo →</Link></div></main>;
  const registrations = await db.warrantyRegistration.findMany({
    where: { customerId: customer.id, unit: { brand: { demoSessionId: sessionId } } },
    include: { unit: { include: { productModel: true, purchaseOrder: true, brand: true } }, claim: true },
    orderBy: { registeredAt: "desc" },
  });
  const claims = registrations.flatMap((registration) => registration.claim ? [{ claim: registration.claim, product: registration.unit.productModel.name }] : []).sort((a,b) => b.claim.submittedAt.getTime() - a.claim.submittedAt.getTime());
  const active = registrations.filter((r) => isCoverageActive(r.coverageEndsOn));
  const expiring = active.filter((r) => daysRemaining(r.coverageEndsOn) <= 90);
  const expired = registrations.length - active.length;
  const filters = [["All products", "all", registrations.length], ["Under warranty", "covered", active.length], ["Expiring soon", "expiring", expiring.length], ["Expired", "expired", expired]] as const;
  const selectedFilter = query.filter || "all";
  const visibleRegistrations = registrations.filter((registration) => {
    const days = daysRemaining(registration.coverageEndsOn);
    const covered = isCoverageActive(registration.coverageEndsOn);
    return selectedFilter === "expired" ? !covered : selectedFilter === "expiring" ? covered && days <= 90 : selectedFilter === "covered" ? covered : true;
  });
  return <><CustomerNav sessionId={sessionId} customerName={customer.name} /><main className="page-wrap content">
    <section className="hero"><div className="hero-copy"><div className="eyebrow">Your Vouch customer space</div><h1>Your products,<br />all in one place.</h1><p>Track warranty status, raise claims and keep your purchase details handy.</p><div style={{ marginTop: 20 }}><Link className="action" href={`/demo/${sessionId}/register`}><PackagePlus size={15}/> Register a product</Link></div></div><div className="hero-art"><div className="headphone"/><div className="hero-stripe"/></div></section>
    {query.notice && <div className="notice">{query.notice === "registered" ? "Your product is registered. Warranty coverage follows the original delivery date." : "This unit is already registered. Your existing warranty card is below."}</div>}
    {query.error && <div className="notice error">We couldn’t complete that action. Check the unit details and try again.</div>}
    <div className="filters">{filters.map(([label,value,count])=><Link key={value} href={value==="all"?`/demo/${sessionId}/customer`:`/demo/${sessionId}/customer?filter=${value}`} className={`filter ${selectedFilter===value?"active":""}`}>{label}<span className="filter-count">{count}</span></Link>)}<span className="sort-label">Newest first　⌄</span></div>
    {registrations.length ? visibleRegistrations.length ? <div className="product-grid">{visibleRegistrations.map((registration) => {
      const remaining = daysRemaining(registration.coverageEndsOn);
      const total = Math.max(1, (registration.coverageEndsOn.getTime() - registration.coverageStartsOn.getTime()) / 86_400_000);
      const percent = remaining === 0 ? 0 : Math.max(3, Math.min(100, Math.round(remaining / total * 100)));
      const covered = isCoverageActive(registration.coverageEndsOn);
      const status = !covered ? "Expired" : remaining === 0 ? "Covered through today" : remaining <= 90 ? "Expiring soon" : "Under warranty";
      const badgeClass = !covered ? "badge expired" : remaining <= 90 ? "badge warning" : "badge";
      return <article className="product-card" id={`product-${registration.id}`} key={registration.id}>
        <ProductVisual imageUrl={registration.unit.productModel.imageUrl} name={registration.unit.productModel.name} kind={registration.unit.productModel.slug.includes("charge") ? "charger" : "headphones"}/>
        <div className="product-copy"><h2>{registration.unit.productModel.name}</h2><p>{registration.unit.brand.name}</p><span className={badgeClass}>{status}</span>
          <div className="warranty-remaining"><strong>{remaining}</strong><span>days remaining</span></div><div className="progress"><span style={{ width: `${percent}%` }}/></div>
          <div className="product-meta"><span>Unit ID</span><b>{registration.unit.serialNumber}</b></div>
          <div className="product-meta"><span>Delivered</span><b>{registration.unit.purchaseOrder.deliveredOn ? formatDate(registration.unit.purchaseOrder.deliveredOn) : "—"}</b></div>
          <div className="product-meta"><span>Coverage ends</span><b>{formatDate(registration.coverageEndsOn)}</b></div>
          <div className="card-actions"><Link className="action secondary" href={`/demo/${sessionId}/customer/products/${registration.unitId}`}>Details</Link>{registration.claim ? <Link className="action" href={`/demo/${sessionId}/customer/claims/${registration.claim.id}`}>View claim</Link> : covered && <Link className="action" href={`/demo/${sessionId}/customer/claims/new?unitId=${registration.unitId}`}>Raise a claim</Link>}</div>
        </div>
      </article>;
    })}</div> : <div className="blank-state" style={{ marginTop: 18 }}>No products in this warranty filter.</div> : <div className="blank-state" style={{ marginTop: 18 }}>No products registered yet. Choose a product and enter its unit ID to create your warranty card.</div>}
    <section className="section-head" id="claims"><div><h2>Recent claims</h2><p>Follow the latest updates from your brand.</p></div><Link href={`/demo/${sessionId}/customer/claims`} className="muted" style={{fontSize:12}}>View all <ArrowRight size={13} style={{verticalAlign:"middle"}}/></Link></section>
    {claims.length ? <div className="claims-list">{claims.slice(0,4).map(({claim,product})=><Link className="claim-row" key={claim.id} href={`/demo/${sessionId}/customer/claims/${claim.id}`}><span className="claim-name">{claim.reference}</span><span className="claim-product">{product} · {claim.issueTitle}</span><span className={`status-pill ${claim.status.toLowerCase()}`}>{claim.status.replaceAll("_"," ")}</span><span className="claim-date muted">{formatDate(claim.submittedAt)}</span><ChevronRight size={15} color="#a3a39e"/></Link>)}</div> : <div className="blank-state">No claims yet. If something goes wrong, your claim updates will show here.</div>}
    <p className="footer-note">Demo workspace · Products and coverage records from your brand</p>
  </main></>;
}
