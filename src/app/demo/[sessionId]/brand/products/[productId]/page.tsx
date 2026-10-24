import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package, Pencil, Link2, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { isUuid, requireBrand } from "@/lib/brand";
import { daysRemaining, formatDate } from "@/lib/dates";
import { BrandCopyLink } from "@/components/brand-copy-link";
import { BrandUnitForm, BrandUnitDeliveryForm } from "@/components/brand-product-form";

export default async function ProductPage({ params, searchParams }: { params: Promise<{ sessionId: string; productId: string }>; searchParams: Promise<{ created?: string }> }) {
  const { sessionId, productId } = await params;
  if (!isUuid(productId)) notFound();
  const { created } = await searchParams;
  const brand = await requireBrand(sessionId);
  const product = await db.productModel.findFirst({ where: { id: productId, brandId: brand.id }, include: { units: { include: { purchaseOrder: true, registration: { include: { customer: true } } }, orderBy: { createdAt: "desc" } } } });
  if (!product) notFound();
  const registrationPath = `/demo/${sessionId}/register/${brand.slug}/${product.slug}`;
  return <><Link className="business-back" href={`/demo/${sessionId}/brand/products`}><ArrowLeft size={14}/>Products</Link><div className="business-page-header"><div><h1>{product.name}</h1><p>Manage your registration link, units, and warranty coverage.</p></div><Link className="business-button" href={`/demo/${sessionId}/brand/products/${product.id}/edit`}><Pencil size={14}/>Edit product</Link></div>{created && <div className="business-notice">Product created. Your registration link is ready to share.</div>}
    <div className="business-product-overview"><div className="business-product-image">{product.imageUrl ? <img src={product.imageUrl} alt={product.name}/> : <Package size={42} strokeWidth={1.3}/>}</div><div><div className="business-eyebrow">{brand.name}</div><h2>{product.name}</h2><p className="business-muted">SKU: {product.sku || "Not set"}</p><div className="business-product-facts"><span>{product.warrantyMonths} months warranty</span><span>{product.units.length} units</span><span>{product.units.filter((unit) => unit.registration).length} registered</span></div></div></div>
    <section className="business-panel business-link-panel"><div className="business-panel-header"><div><h2><Link2 size={16}/> Customer registration link</h2><p>Customers enter their stamped unit ID. After registration, this product appears on their warranty dashboard.</p></div></div><div className="business-form-section"><BrandCopyLink path={registrationPath}/></div></section>
    <section className="business-panel"><div className="business-panel-header"><div><h2>Product units</h2><p>Match every stamped ID with an order and the brand’s delivery record.</p></div><a className="business-button small" href="#add-unit"><Plus size={14}/>Add unit</a></div><div className="business-table-wrap"><table className="business-table"><thead><tr><th>Unit ID</th><th>Order</th><th>Delivered</th><th>Customer</th><th>Warranty</th></tr></thead><tbody>{product.units.map((unit) => <tr key={unit.id}><td className="business-mono">{unit.serialNumber}</td><td>{unit.purchaseOrder.orderNumber}</td><td>{unit.purchaseOrder.deliveredOn ? formatDate(unit.purchaseOrder.deliveredOn) : <BrandUnitDeliveryForm sessionId={sessionId} productId={productId} unitId={unit.id}/>}</td><td>{unit.registration?.customer.name || <span className="business-muted">Not registered</span>}</td><td>{unit.registration ? `${daysRemaining(unit.registration.coverageEndsOn)} days left` : <span className="business-muted">Starts from delivery</span>}</td></tr>)}</tbody></table>{!product.units.length && <div className="business-empty"><p>Add a unit below so customers can register this product.</p></div>}</div></section>
    <section className="business-panel business-unit-panel" id="add-unit"><div className="business-panel-header"><div><h2>Add a unit</h2><p>Record the physical unit before the customer registers it.</p></div></div><BrandUnitForm sessionId={sessionId} productId={productId}/></section>
  </>;
}
