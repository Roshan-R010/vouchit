import { VouchLogo } from "@/components/vouch-logo";
import { prefetchApi } from "@/lib/api-fetch";
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Inbox, Package, Users, ClipboardList, BarChart2, Settings, ArrowUpRight, RotateCcw } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

export function BrandNav({ sessionId, brandName, logoUrl }: { sessionId: string; brandName: string; logoUrl?: string | null }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const base = `/demo/${sessionId}/brand`;
  const links = [
    { title: "Dashboard", href: base, icon: LayoutDashboard },
    { title: "Claims", href: `${base}/claims`, icon: Inbox },
    { title: "Products", href: `${base}/products`, icon: Package },
    { title: "Customers", href: `${base}/customers`, icon: Users },
    { title: "Registrations", href: `${base}/registrations`, icon: ClipboardList },
    { title: "Analytics", href: `${base}/analytics`, icon: BarChart2 },
  ];
  return <aside className="business-sidebar">
    <Link href={base} className="business-logo"><VouchLogo /></Link>
    <div className="business-workspace"><span className="business-workspace-avatar">{logoUrl ? <img src={logoUrl} alt=""/> : brandName.slice(0, 1)}</span><div><strong>{brandName}</strong><small>Brand workspace</small></div></div>
    <div className="business-nav-caption">Workspace</div>
    <nav className="business-nav" aria-label="Business navigation">{links.map(({ title, href, icon: Icon }) => {
      const active = title === "Dashboard" ? pathname === href : pathname.startsWith(href);
      return <Link key={href} href={href} onPointerEnter={() => prefetchApi(`/api${href}`)} onFocus={() => prefetchApi(`/api${href}`)} className={`business-nav-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
        {active && <motion.span className="business-nav-active" layoutId="business-nav-highlight" transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 440, damping: 36 }} />}
        <Icon size={17} /><span>{title}</span>
      </Link>;
    })}</nav>
    <div className="business-sidebar-bottom"><Link className={`business-nav-link ${pathname.endsWith("/settings") ? "active" : ""}`} href={`${base}/settings`}><Settings size={17}/>Settings</Link><Link className="business-nav-link" href={`/demo/${sessionId}/customer`}><ArrowUpRight size={17}/>Customer view</Link><form action={`/demo/${sessionId}/reset`} method="post" onSubmit={(event) => { if (!window.confirm("Clear this workspace? This permanently removes the brand, products, units, registrations and claims.")) event.preventDefault(); }}><button type="submit" className="business-nav-link"><RotateCcw size={16}/>Clear workspace</button></form></div>
  </aside>;
}
