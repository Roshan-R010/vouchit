import Link from "next/link";
import { Package, Plus, ArrowUpRight, Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireBrand } from "@/lib/brand";
import { BrandCopyLink } from "@/components/brand-copy-link";

export default async function ProductsPage({ params, searchParams }: { params: Promise<{ sessionId: string }>; searchParams: Promise<{ q?: string }> }) {
  const { sessionId } = await params;
  const { q } = await searchParams;
  const brand = await requireBrand(sessionId);
  const products = await db.productModel.findMany({ where: { brandId: brand.id, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { sku: { contains: q, mode: "insensitive" as const } }] } : {}) }, include: { units: { select: { registration: { select: { id: true } } } } }, orderBy: { name: "asc" } });
  return <><div className="business-page-header"><div><div className="business-eyebrow">Your catalog</div><h1>Products</h1><p>Manage coverage and share a registration link for every product.</p></div><Link href={`/demo/${sessionId}/brand/products/new`} className="business-button primary"><Plus size={16}/>Add product</Link></div>
    <form className="business-search" action={`/demo/${sessionId}/brand/products`}><Search size={16}/><input aria-label="Search products" name="q" defaultValue={q || ""} placeholder="Search products or SKU…"/><button className="business-button small">Search</button></form>
    {products.length ? <div className="business-catalog">{products.map((product) => <article className="business-product-card" key={product.id}><Link className="business-product-image" href={`/demo/${sessionId}/brand/products/${product.id}`}>{product.imageUrl ? <img src={product.imageUrl} alt={product.name}/> : <Package size={38} strokeWidth={1.3}/>}</Link><div className="business-product-card-body"><div className="business-product-title"><Link href={`/demo/${sessionId}/brand/products/${product.id}`}>{product.name}</Link><Link href={`/demo/${sessionId}/brand/products/${product.id}`} aria-label={`Manage ${product.name}`}><ArrowUpRight size={16}/></Link></div><p className="business-muted">{product.sku || "No SKU"}</p><div className="business-product-facts"><span>{product.warrantyMonths} months warranty</span><span>{product.units.filter((unit) => unit.registration).length} registered / {product.units.length} units</span></div><BrandCopyLink compact path={`/demo/${sessionId}/register/${brand.slug}/${product.slug}`}/></div></article>)}</div> : <div className="business-empty"><Package size={28}/><h2>{q ? "No matching products" : "Add your first product"}</h2><p>{q ? "Try another product name or SKU." : "Upload a photo, set the warranty, and generate a link for your customers."}</p>{!q && <Link className="business-button primary" href={`/demo/${sessionId}/brand/products/new`}>Add product</Link>}</div>}
  </>;
}
