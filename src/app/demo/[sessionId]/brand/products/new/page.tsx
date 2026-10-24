import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireBrand } from "@/lib/brand";
import { BrandProductForm } from "@/components/brand-product-form";

export default async function NewProductPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  await requireBrand(sessionId);
  return <div className="business-form-page"><Link className="business-back" href={`/demo/${sessionId}/brand/products`}><ArrowLeft size={14}/>Products</Link><div className="business-page-header"><div><h1>Add a product</h1><p>A photo, a coverage policy, and one clear link to share.</p></div></div><BrandProductForm sessionId={sessionId}/></div>;
}
