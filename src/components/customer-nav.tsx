"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

export function CustomerNav({ sessionId, customerName = "Demo customer" }: { sessionId?: string; customerName?: string }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const root = sessionId ? `/demo/${sessionId}` : "/";
  const items = [
    { label: "My Products", href: sessionId ? `${root}/customer` : "/" },
    { label: "Support", href: sessionId ? `${root}/customer/claims` : "/#how-it-works" },
  ];
  return <header className="topbar page-wrap">
    <Link href={sessionId ? `${root}/customer` : "/"} className="brandmark" aria-label="Vouch home"><span className="brandmark-symbol">V</span>vouch</Link>
    <nav className="nav-links" aria-label="Customer navigation">{items.map((item) => {
      const active = item.label === "My Products" ? pathname.includes("/customer") && !pathname.includes("/customer/claims") || pathname.includes("/register") : pathname.includes("/customer/claims");
      return <Link key={item.label} href={item.href} className={`nav-link ${active ? "active" : ""}`}>
        {item.label}{active && <motion.span className="nav-underline" layoutId="customer-nav-underline" transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }} />}
      </Link>;
    })}</nav>
    <div className="topbar-end">{sessionId && <><Link className={`nav-link brand-switch ${pathname.includes("/brand")?"active":""}`} href={`${root}/brand`}>Brand view</Link><form action={`${root}/reset`} method="post" onSubmit={(event) => { if (!window.confirm("Reset this demo? Products, images and claims you added in this session will be removed.")) event.preventDefault(); }}><button className="reset-link" type="submit">Reset demo</button></form></>}<span className="demo-tag">Interactive demo</span>{sessionId && <><span className="avatar">{customerName.slice(0, 1).toUpperCase()}</span><span>{customerName}</span></>}</div>
  </header>;
}
