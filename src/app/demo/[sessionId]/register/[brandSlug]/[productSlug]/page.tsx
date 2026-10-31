import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { CustomerNav } from "@/components/customer-nav";
import { ProductVisual } from "@/components/product-visual";
import { CustomerSubmit } from "@/components/customer-submit";
import { registerWarrantyAction } from "@/app/actions";
import { db } from "@/lib/db";
import { addCalendarMonths, dateOnly, formatDate } from "@/lib/dates";
import styles from "@/components/customer-product.module.css";
import { isUuid } from "@/lib/brand";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ sessionId: string; brandSlug: string; productSlug: string }>; searchParams: Promise<{ serialNumber?: string; error?: string }> };
const messages: Record<string, string> = {
  missing: "Enter the stamped unit ID to continue.",
  "not-found": "We couldn’t find that unit for this product. Check the ID and try again.",
  "not-delivered": "Delivery has not been recorded for this unit yet. Please contact the brand before registering.",
  contact: "Enter your name and a valid contact email.",
};

export default async function RegisterPage({ params, searchParams }: Props) {
  const { sessionId, brandSlug, productSlug } = await params;
  if (!isUuid(sessionId)) notFound();
  const query = await searchParams;
  const product = await db.productModel.findFirst({ where: { slug: productSlug, brand: { slug: brandSlug, demoSessionId: sessionId } }, include: { brand: true } });
  if (!product) notFound();
  const serialNumber = (query.serialNumber || "").trim().toUpperCase().slice(0, 100);
  const found = serialNumber ? await db.productUnit.findFirst({
    where: { serialNumber, brandId: product.brandId, productModelId: product.id },
    include: { purchaseOrder: true, registration: true, sales: { where: { isCurrent: true }, take: 1 }, _count: { select: { sales: true } } },
  }) : null;
  const unit = found && found.purchaseOrder?.brandId === product.brandId ? found : null;
  const delivered = unit?.sales[0]?.confirmedDeliveredOn;
  const eligible = unit?.status === "DELIVERED" && !!delivered && dateOnly(delivered).getTime() <= dateOnly(new Date()).getTime();
  const checkError = serialNumber ? !unit ? "not-found" : !eligible ? "not-delivered" : undefined : undefined;
  const error = query.error || checkError;
  const registrationPath = `/demo/${sessionId}/register/${brandSlug}/${productSlug}`;
  return <><CustomerNav sessionId={sessionId} customerName="Customer" brandName={product.brand.name} brandLogoUrl={product.brand.logoUrl}/><main className="page-wrap content"><div className="form-shell">
    <header className="form-header">
      <Link href={`/demo/${sessionId}/register`} className="muted" style={{ fontSize: 12 }}><ArrowLeft size={13} style={{ verticalAlign: "middle" }}/> All products</Link>
      <div className={styles.productHeading}>
        <ProductVisual imageUrl={product.imageUrl} name={product.name} kind={product.slug.includes("charge") ? "charger" : "headphones"}/>
        <div><div className="eyebrow" style={{ marginBottom: 8 }}>{product.brand.name}</div><h2>{product.name}</h2><p>{product.warrantyMonths} months of coverage from the recorded delivery date.</p></div>
      </div>
    </header>
    <div className="form-body">
      <h1 style={{ fontSize: 25, letterSpacing: -0.8, margin: "0 0 10px" }}>Let’s register your product.</h1>
      <p className={styles.helpText}>Find the unit ID stamped on your product. We’ll match it to the brand’s order record.</p>
      <form method="get" action={registrationPath}>
        <div className="field"><label htmlFor="serialNumber">Unit ID</label><input id="serialNumber" name="serialNumber" placeholder="Enter your stamped unit ID" defaultValue={serialNumber} maxLength={100} autoCapitalize="characters" required/></div>
        <button className="action secondary" type="submit">Check unit</button>
      </form>
      {error && <div className="notice error" role="alert">{messages[error] || "We couldn’t register this product."}</div>}
      {unit && eligible && delivered && <div className="match-panel">
        <strong><CheckCircle2 size={15} style={{ verticalAlign: "middle", marginRight: 6, color: "#427b50" }}/> Unit matched to your product</strong>
        <dl className={styles.facts}>
          <div className={styles.fact}><dt>Product</dt><dd>{product.name}</dd></div>
          <div className={styles.fact}><dt>Unit ID</dt><dd>{unit.serialNumber}</dd></div>
          <div className={styles.fact}><dt>Delivered</dt><dd>{formatDate(delivered)}</dd></div>
          <div className={styles.fact}><dt>Coverage ends</dt><dd>{formatDate(unit.registration?.coverageEndsOn || addCalendarMonths(delivered, product.warrantyMonths))}</dd></div>
        </dl>
        {unit.registration && <><p>This unit is already registered. Your existing warranty card is ready.</p><Link className="action" style={{ marginTop: 14 }} href={`/demo/${sessionId}/customer/products/${unit.id}`}>Open warranty card</Link></>}
      </div>}
      {unit && eligible && !unit.registration && <form action={registerWarrantyAction} style={{ marginTop: 25 }}>
        <input type="hidden" name="sessionId" value={sessionId}/><input type="hidden" name="brandSlug" value={brandSlug}/><input type="hidden" name="productSlug" value={productSlug}/><input type="hidden" name="serialNumber" value={unit.serialNumber}/>
        <div className="field"><label htmlFor="orderNumber">Order ID (required for resold units)</label><input id="orderNumber" name="orderNumber" maxLength={120} required={unit._count.sales > 1}/></div>
        <div className="field"><label htmlFor="customerName">Your name</label><input id="customerName" name="customerName" required maxLength={100}/></div>
        <div className="field"><label htmlFor="email">Contact email</label><input id="email" name="email" type="email" required maxLength={200}/></div>
        <CustomerSubmit label="Register warranty" pendingLabel="Registering…"/>
      </form>}
      <p className={styles.helpText} style={{ marginTop: 22 }}><ShieldCheck size={14} style={{ verticalAlign: "middle", marginRight: 6 }}/> Registering does not restart or extend your coverage. No email is sent in this demo.</p>
    </div>
  </div></main></>;
}
