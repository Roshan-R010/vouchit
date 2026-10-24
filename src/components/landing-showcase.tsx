import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";
import { ProductPhoto } from "@/components/product-photo";

export function LandingShowcase() {
  const [data, setData] = useState<any>(null);
  const [sessionId] = useState(() => typeof window !== "undefined" ? localStorage.getItem("vouch-demo-session") : null);
  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    apiFetch(`/api/demo/${sessionId}/brand/products`).then(readApiResponse).then(result => { if (active) setData(result); }).catch(() => {});
    return () => { active = false; };
  }, [sessionId]);
  return <section className="landing-showcase" id="product"><div className="landing-showcase-inner"><div className="landing-section-intro light-intro"><span className="landing-kicker">Your products. Your records.</span><h2>Aftercare starts<br/><em>with the details.</em></h2><p>Product photos, coverage and customer support, connected in one place.</p></div>
    {data && <div className="live-catalog"><h3>{data.brand.name}</h3><div className="customer-catalog">{data.products.map((product: any) => <article key={product.id}><div className="customer-catalog-photo">{product.imageUrl && <ProductPhoto src={product.imageUrl} alt={product.name}/>}</div><div><h2>{product.name}</h2><p>{product.warrantyMonths} months of warranty</p></div></article>)}</div></div>}
    <div className="showcase-bottom"><span>One connected workspace for brands and customers.</span><Link href={sessionId ? `/demo/${sessionId}/brand` : "/demo?view=brand"}>Open workspace <ArrowUpRight size={15}/></Link></div>
  </div></section>;
}
