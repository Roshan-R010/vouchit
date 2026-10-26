import { VouchLogo } from "@/components/vouch-logo";
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "react-router-dom";

export function CustomerNav({ sessionId, customerName = "Customer", brandName, brandLogoUrl }: { sessionId?: string; customerName?: string; brandName?: string; brandLogoUrl?: string | null }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const { account, signOut } = useAuth();
  const navigate = useNavigate();
  const items = [
    { label: "Warranties", href: "/customer" },
    { label: "Support", href: "/customer/claims" },
  ];
  return <header className="topbar page-wrap">
    <Link href={account?.role === "CUSTOMER" ? "/customer" : "/"} className="brandmark" aria-label="Vouch home"><VouchLogo /></Link>
    <nav className="nav-links" aria-label="Customer navigation">{items.map((item) => {
      const active = item.label === "Warranties" ? (pathname.includes("/customer") && !pathname.includes("/customer/claims")) || pathname.includes("/register") : pathname.includes("/customer/claims");
      return <Link key={item.label} href={item.href} className={`nav-link ${active ? "active" : ""}`}>
        {item.label}{active && <motion.span className="nav-underline" layoutId="customer-nav-underline" transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }} />}
      </Link>;
    })}</nav>
    <div className="topbar-end">
      {sessionId && brandName && <span style={{ fontSize: 14, color: "#56616c", fontWeight: 450, marginRight: 8, display: "inline-flex", alignItems: "center", gap: 6 }}>{brandLogoUrl && <img src={brandLogoUrl} alt="" style={{ width: 18, height: 18, borderRadius: 4, objectFit: "contain" }}/>} {brandName} · Customer portal</span>}
      {account?.role === "CUSTOMER" && <><span className="avatar">{customerName.slice(0, 1).toUpperCase()}</span><span style={{ fontSize: 14, fontWeight: 600, color: "#171918" }}>{customerName}</span><button className="nav-signout" onClick={() => { void signOut().then(() => navigate("/")); }}>Sign out</button></>}
    </div>
  </header>;
}
