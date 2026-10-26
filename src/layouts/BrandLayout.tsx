import { useEffect, useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import { BrandNav } from "@/components/brand-nav";
import { RouteTransition } from "@/components/route-transition";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";
import "@/app/brand.css";

export function BrandLayout() {
  const { sessionId } = useParams();
  const [brand, setBrand] = useState<{ name: string; logoUrl: string | null } | null>(null);
  useEffect(() => {
    if (!sessionId) return;
    localStorage.setItem("vouch-demo-session", sessionId);
    let active = true;
    const update = () => { void apiFetch(`/api/demo/${sessionId}/brand/settings`).then(readApiResponse).then(data => { if (active) { setBrand(data.brand); localStorage.setItem("vouch-demo-has-brand", "true"); } }).catch(() => {}); };
    update(); window.addEventListener("vouch:data-changed", update);
    return () => { active = false; window.removeEventListener("vouch:data-changed", update); };
  }, [sessionId]);
  if (!sessionId) return <p>Workspace not found.</p>;
  return <div className="business-shell">
    <BrandNav sessionId={sessionId} brandName={brand?.name || "Your brand"} logoUrl={brand?.logoUrl}/>
    <div className="business-main"><header className="business-topbar"><span><strong>{brand?.name || "Your brand"}</strong><span className="business-muted"> / Business</span></span></header><main className="business-content"><RouteTransition><Outlet/></RouteTransition></main></div>
  </div>;
}
export default BrandLayout;
