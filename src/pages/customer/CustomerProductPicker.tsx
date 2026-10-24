import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";
import { ProductPhoto } from "@/components/product-photo";

export default function CustomerProductPicker() {
  const { sessionId } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; apiFetch(`/api/demo/${sessionId}/brand/products`).then(readApiResponse).then(result => { if(active) setData(result); }).catch(cause => { if(active) setError(cause.message); }); return () => { active = false; }; }, [sessionId]);
  return <main className="page-wrap content"><div className="section-head"><div><h1>Register a product</h1><p>Choose your product, then enter the serial number from your purchase.</p></div></div>{error && <p role="alert">{error}</p>}{!data && !error && <p>Loading products…</p>}<div className="customer-catalog">{data?.products.map((product: any) => <article key={product.id}><div className="customer-catalog-photo">{product.imageUrl && <ProductPhoto src={product.imageUrl} alt={product.name}/>}</div><div><h2>{product.name}</h2><p>{product.warrantyMonths} months of warranty</p><Link className="action" to={`/demo/${sessionId}/register/${data.brand.slug}/${product.slug}`}>Register product</Link></div></article>)}</div>{data && !data.products.length && <p>Your brand hasn’t added products yet.</p>}</main>;
}
