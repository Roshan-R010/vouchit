import { useEffect, useState } from "react";
import { Outlet, useParams, useLocation } from "react-router-dom";
import { BrandNav } from "@/components/brand-nav";
import { RouteTransition } from "@/components/route-transition";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";
import "@/app/brand.css";
import "@/app/brand-sidebar.css";

export function BrandLayout() {
  const { sessionId } = useParams();
  const { pathname } = useLocation();
  const section = pathname.split("/brand")[1]?.split("/")[1];
  const sectionLabel = ({ claims: "Claims", products: "Products", customers: "Customers", registrations: "Registrations", analytics: "Analytics", settings: "Settings" } as Record<string, string>)[section || ""] || "Dashboard";
  const [brand, setBrand] = useState<{ name: string; logoUrl: string | null } | null>(null);
  const [navExpanded, setNavExpanded] = useState(() => {
    try { return window.innerWidth > 760 && window.localStorage.getItem("vouch-brand-nav-expanded") !== "false"; } catch { return window.innerWidth > 760; }
  });
  const toggleNav = () => setNavExpanded((value) => {
    try { window.localStorage.setItem("vouch-brand-nav-expanded", String(!value)); } catch { /* Storage may be unavailable. */ }
    return !value;
  });
  useEffect(() => {
    if (!sessionId) return;
    localStorage.setItem("vouch-demo-session", sessionId);
    let active = true;
    const update = () => { void apiFetch(`/api/demo/${sessionId}/brand/settings`).then(readApiResponse).then(data => { if (active) { setBrand(data.brand); localStorage.setItem("vouch-demo-has-brand", "true"); } }).catch(() => {}); };
    update(); window.addEventListener("vouch:data-changed", update);
    return () => { active = false; window.removeEventListener("vouch:data-changed", update); };
  }, [sessionId]);
  if (!sessionId) return <p>Workspace not found.</p>;
  return <div className="business-shell brand-shell" data-nav-expanded={navExpanded}>
    <BrandNav sessionId={sessionId} brandName={brand?.name || "Your brand"} logoUrl={brand?.logoUrl} expanded={navExpanded} onToggle={toggleNav}/>
    {navExpanded && <button type="button" className="brand-nav-scrim" aria-label="Close navigation" onClick={toggleNav}/>}
    <div className="business-main"><header className="business-topbar"><span><strong>{brand?.name || "Your brand"}</strong><span className="business-muted"> / {sectionLabel}</span></span></header><main className="business-content"><RouteTransition><Outlet/></RouteTransition></main></div>
  </div>;
}
export default BrandLayout;
