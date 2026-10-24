import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CustomerNav } from "@/components/customer-nav";
import { ProductVisual } from "@/components/product-visual";
import styles from "@/components/customer-product.module.css";
import { isUuid } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function ProductChooser({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) notFound();
  const [customer, products] = await Promise.all([
    db.customer.findFirst({ where: { demoSessionId: sessionId } }),
    db.productModel.findMany({ where: { brand: { demoSessionId: sessionId } }, include: { brand: true }, orderBy: { name: "asc" } }),
  ]);
  return <><CustomerNav sessionId={sessionId} customerName={customer?.name || "Customer"} brandName={products[0]?.brand.name} brandLogoUrl={products[0]?.brand.logoUrl}/><main className="page-wrap content">
    <div className="section-head" style={{ marginTop: 36 }}><div><Link className="muted" href={`/demo/${sessionId}/customer`} style={{ fontSize: 12 }}><ArrowLeft size={13} style={{ verticalAlign: "middle" }}/> My products</Link><h1 style={{ margin: "14px 0 8px", fontSize: 31, letterSpacing: -1 }}>Register your product.</h1><p>Select your product, then enter the unit ID stamped on it.</p></div></div>
    <div className={styles.catalog}>{products.map((product) => <article className={styles.catalogCard} key={product.id}>
      <ProductVisual imageUrl={product.imageUrl} name={product.name} kind={product.slug.includes("charge") ? "charger" : "headphones"}/>
      <div><p style={{ marginBottom: 6 }}>{product.brand.name}</p><h2>{product.name}</h2></div>
      <p>{product.warrantyMonths} months of warranty from delivery{product.sku ? ` · ${product.sku}` : ""}</p>
      <Link className="action secondary" href={`/demo/${sessionId}/register/${product.brand.slug}/${product.slug}`}>Register this product <ArrowRight size={14}/></Link>
    </article>)}</div>
    {!products.length && <div className="blank-state">No products have been added yet. Products added in the business workspace will appear here.</div>}
  </main></>;
}
