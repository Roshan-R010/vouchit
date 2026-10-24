"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

export function CustomerNav({ sessionId, customerName = "Customer", brandName = "Your brand", brandLogo }: { sessionId?: string; customerName?: string; brandName?: string; brandLogo?: string | null }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const root = sessionId ? `/demo/${sessionId}` : "/";
  const items = [
    { label: "Warranties", href: sessionId ? `${root}/customer` : "/" },
    { label: "Support", href: sessionId ? `${root}/customer/claims` : "/#how-it-works" },
  ];
  return <header className="topbar page-wrap">
    <Link href={sessionId ? `${root}/customer` : "/"} className="brandmark" aria-label="Vouch home"><span className="brandmark-symbol">V</span>vouch</Link>
    <nav className="nav-links" aria-label="Customer navigation">{items.map((item) => {
      const active = item.label === "Warranties" ? (pathname.includes("/customer") && !pathname.includes("/customer/claims")) || pathname.includes("/register") : pathname.includes("/customer/claims");
      return <Link key={item.label} href={item.href} className={`nav-link ${active ? "active" : ""}`}>
        {item.label}{active && <motion.span className="nav-underline" layoutId="customer-nav-underline" transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }} />}
      </Link>;
    })}</nav>
    <div className="topbar-end">
      {brandLogo && <img className="portal-brand-logo" src={brandLogo} alt={`${brandName} logo`}/>}
      {sessionId && <span style={{ fontSize: 12, color: "#777b78", fontWeight: 450, marginRight: 8 }}>{brandName} · Customer portal</span>}
      {sessionId && <Link className={`nav-link brand-switch ${pathname.includes("/brand") ? "active" : ""}`} href={`${root}/brand`} style={{ fontSize: 11, color: "#777b78", textDecoration: "none", marginRight: 8 }}>Brand view</Link>}
      {sessionId && <><span className="avatar">{customerName.slice(0, 1).toUpperCase()}</span><span style={{ fontSize: 13, fontWeight: 600, color: "#171918" }}>{customerName}</span></>}
    </div>
  </header>;
}
