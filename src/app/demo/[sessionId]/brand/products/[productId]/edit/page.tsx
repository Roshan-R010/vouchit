import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { isUuid, requireBrand } from "@/lib/brand";
import { BrandProductForm } from "@/components/brand-product-form";

export default async function EditProductPage({ params }: { params: Promise<{ sessionId: string; productId: string }> }) {
  const { sessionId, productId } = await params;
  if (!isUuid(productId)) notFound();
  const brand = await requireBrand(sessionId);
  const product = await db.productModel.findFirst({ where: { id: productId, brandId: brand.id } });
  if (!product) notFound();
  return <div className="business-form-page"><Link className="business-back" href={`/demo/${sessionId}/brand/products/${productId}`}><ArrowLeft size={14}/>{product.name}</Link><div className="business-page-header"><div><h1>Edit product</h1><p>Keep the photo and warranty policy up to date.</p></div></div><BrandProductForm sessionId={sessionId} product={product}/></div>;
}
