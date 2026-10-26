import { VouchLogo } from "@/components/vouch-logo";
import { prefetchApi } from "@/lib/api-fetch";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, Inbox, Package, Users, ClipboardList, BarChart2, Settings, ChevronsLeft, ChevronsRight, LogOut, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";

export function BrandNav({ sessionId, brandName, logoUrl, expanded, onToggle }: { sessionId: string; brandName: string; logoUrl?: string | null; expanded?: boolean; onToggle?: () => void }) {
  const { pathname } = useLocation();
  const [internalExpanded, setInternalExpanded] = useState(true);
  const isExpanded = expanded ?? internalExpanded;
  const toggle = onToggle ?? (() => setInternalExpanded((value) => !value));
  const reduceMotion = useReducedMotion();
  const { account, signOut } = useAuth();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!accountOpen) return;
    const close = (event: PointerEvent) => { if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false); };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [accountOpen]);
  useEffect(() => { setAccountOpen(false); }, [pathname]);
  const base = `/demo/${sessionId}/brand`;
  const links = [
    { title: "Dashboard", href: base, icon: LayoutDashboard },
    { title: "Claims", href: `${base}/claims`, icon: Inbox },
    { title: "Products", href: `${base}/products`, icon: Package },
    { title: "Customers", href: `${base}/customers`, icon: Users },
    { title: "Registrations", href: `${base}/registrations`, icon: ClipboardList },
    { title: "Analytics", href: `${base}/analytics`, icon: BarChart2 },
  ];
  return <aside className="brand-rail-sidebar" aria-label="Brand workspace">
    <div className="brand-rail-header"><Link to={base} className="brand-rail-mark" aria-label="Vouch dashboard">V<span>.</span></Link><div className="brand-rail-header-panel"><Link to={base} className="brand-rail-wordmark"><VouchLogo /></Link><button type="button" className="brand-rail-toggle" onClick={toggle} aria-label="Collapse sidebar" title="Collapse sidebar"><ChevronsLeft size={17}/></button></div></div>
    <div className="brand-rail-workspace"><div className="brand-rail-workspace-spacer"/><div className="brand-rail-workspace-panel"><span className="brand-rail-brand-avatar">{logoUrl ? <img src={logoUrl} alt=""/> : brandName.slice(0, 2)}</span><span className="brand-rail-brand-text"><strong>{brandName}</strong><small>Brand workspace</small></span></div></div>
    {!isExpanded && <button type="button" className="brand-rail-expand" onClick={toggle} aria-label="Expand sidebar" title="Expand sidebar"><ChevronsRight size={16}/></button>}
    <nav className="brand-rail-nav" aria-label="Business navigation">{links.map(({ title, href, icon: Icon }) => {
      const active = title === "Dashboard" ? pathname === href : pathname.startsWith(href);
      return <Link key={href} to={href} onPointerEnter={() => prefetchApi(`/api${href}`)} onFocus={() => prefetchApi(`/api${href}`)} className={`brand-rail-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined} title={!isExpanded ? title : undefined}>
        <span className="brand-rail-icon">{active && <motion.span className="brand-rail-icon-active" layoutId="brand-rail-icon-highlight" transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}/>}<Icon size={18} strokeWidth={1.9}/></span><span className="brand-rail-link-label">{title}</span>
      </Link>;
    })}</nav>
    <div className="brand-rail-bottom"><Link className={`brand-rail-link ${pathname.endsWith("/settings") ? "active" : ""}`} to={`${base}/settings`} title={!isExpanded ? "Settings" : undefined}><span className="brand-rail-icon"><Settings size={18} strokeWidth={1.9}/></span><span className="brand-rail-link-label">Settings</span></Link>
      <div className="brand-rail-account-wrap" ref={accountRef}><button type="button" className="brand-rail-account" onClick={() => setAccountOpen((value) => !value)} aria-expanded={accountOpen} aria-label="Account menu"><span className="brand-rail-account-avatar">{account?.displayName?.slice(0, 1) || "B"}</span><span className="brand-rail-account-text"><strong>{account?.displayName || brandName}</strong><small>Brand account</small></span><ChevronRight className="brand-rail-account-chevron" size={15}/></button>
      {accountOpen && <div className="brand-rail-account-menu"><button type="button" onClick={() => { void signOut().then(() => navigate("/")); }}><LogOut size={16}/> Sign out</button></div>}</div>
    </div>
  </aside>;
}
