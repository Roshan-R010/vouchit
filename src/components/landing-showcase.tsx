"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, ChevronRight, Clock3, Package, ShieldCheck } from "lucide-react";

type View = "brand" | "customer";

export function LandingShowcase() {
  const [view, setView] = useState<View>("brand");

  return <section className="landing-showcase" id="product">
    <div className="landing-showcase-inner">
      <div className="landing-section-intro light-intro"><span className="landing-kicker">A clearer kind of product care</span><h2>Every detail.<br/><em>Already in its place.</em></h2><p>One connected view for the people who make a product, and the people who own it.</p></div>
      <div className="showcase-toolbar"><div className="showcase-tabs" role="tablist" aria-label="Choose dashboard preview">
        {(["brand", "customer"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={view === item} className={view === item ? "selected" : ""} onClick={() => setView(item)}>{item === "brand" ? "Brand dashboard" : "Customer dashboard"}</button>)}
      </div><span className="showcase-live"><i/>Two views. One record.</span></div>
      <div className="showcase-window">
        <div className="showcase-window-bar"><div className="window-dots"><i/><i/><i/></div><span>app.vouch.example / {view === "brand" ? "workspace" : "my-products"}</span><div className="window-lock"><ShieldCheck size={13}/> Demo preview</div></div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={view} className="showcase-screen" initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .24, ease: "easeOut" }}>
            {view === "brand" ? <BrandPreview/> : <CustomerPreview/>}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="showcase-bottom"><span>Fictional demo data from Kestrel Audio</span><Link href="/demo?view=brand" prefetch={false}>Launch the interactive demo <ArrowUpRight size={15}/></Link></div>
    </div>
  </section>;
}

function BrandPreview() {
  return <div className="preview-app brand-preview">
    <aside className="preview-sidebar"><div className="preview-brand"><b>V</b><strong>vouch</strong></div><div className="preview-workspace"><span>KA</span><div><strong>Kestrel Audio</strong><small>Brand workspace</small></div></div><small className="preview-label">WORKSPACE</small><div className="preview-menu"><span className="on"><i/>Overview</span><span><i/>Claims <b>04</b></span><span><i/>Products</span><span><i/>Customers</span></div><div className="preview-sidebar-foot"><span/> Demo workspace</div></aside>
    <div className="preview-content"><div className="preview-topline"><span>Workspace <ChevronRight size={12}/> Overview</span><span className="preview-avatar">A</span></div><div className="preview-heading"><div><small>MONDAY, OCTOBER 24</small><h3>Good morning, Aarav.</h3><p>Here’s what needs your attention.</p></div><span className="preview-quiet-tag"><span/> Everything up to date</span></div>
      <div className="preview-stat-row"><div className="preview-stat"><small>OPEN CLAIMS</small><strong>04</strong><span><i/> 2 need a response</span></div><div className="preview-stat"><small>PRODUCTS</small><strong>12</strong><span>Across 3 collections</span></div><div className="preview-stat"><small>REGISTERED UNITS</small><strong>684</strong><span>+18 this month</span></div></div>
      <div className="preview-section-title"><div><strong>Claims to review</strong><small>Your latest customer requests</small></div><span>View inbox <ArrowUpRight size={12}/></span></div>
      <div className="preview-claim-layout"><div className="preview-claim-list"><div className="preview-claim-item active"><span className="preview-claim-dot coral"/><div><strong>Left earcup has stopped working</strong><small>Jamie Park · Kestrel Pro Headphones</small></div><small>12m</small></div><div className="preview-claim-item"><span className="preview-claim-dot gold"/><div><strong>Battery won’t hold a charge</strong><small>Sam Rivera · Kestrel Charge 20K</small></div><small>2h</small></div><div className="preview-claim-item"><span className="preview-claim-dot moss"/><div><strong>Headband adjustment is loose</strong><small>Priya Shah · Kestrel Pro Headphones</small></div><small>1d</small></div></div>
        <div className="preview-claim-detail"><div className="preview-detail-top"><span>VCH-8F31A2</span><b>In review</b></div><strong>Left earcup has stopped working</strong><small>Submitted today by Jamie Park</small><div className="preview-detail-product"><img src="/images/kestrel-pro-headphones.png" alt="Black over ear headphones"/><span><b>Kestrel Pro Headphones</b><small>Unit KST-10483 · 24 months left</small></span></div><div className="preview-detail-link">Open claim <ChevronRight size={12}/></div></div></div>
    </div>
  </div>;
}

function CustomerPreview() {
  return <div className="preview-app customer-preview">
    <aside className="preview-sidebar"><div className="preview-brand"><b>V</b><strong>vouch</strong></div><div className="preview-workspace"><span className="customer-avatar">J</span><div><strong>Jamie Park</strong><small>Customer space</small></div></div><small className="preview-label">YOUR ACCOUNT</small><div className="preview-menu"><span className="on"><i/>My products</span><span><i/>Claims <b>01</b></span><span><i/>Support</span></div><div className="preview-sidebar-foot"><span/> Your product care, together</div></aside>
    <div className="preview-content"><div className="preview-topline"><span>My products</span><span className="preview-avatar">J</span></div><div className="preview-heading customer-heading"><div><small>YOUR VOUCH CUSTOMER SPACE</small><h3>Your products, covered.</h3><p>All the details you need, right where you need them.</p></div><span className="preview-register"><Package size={13}/> Register a product</span></div>
      <div className="preview-product-cards"><div className="preview-product-card"><div className="preview-product-photo"><img src="/images/kestrel-pro-headphones.png" alt="Kestrel Pro headphones"/></div><div className="preview-product-info"><span className="preview-covered"><i/> Under warranty</span><h4>Kestrel Pro Headphones</h4><small>Wireless Noise Cancelling · KST-10483</small><div className="preview-days"><strong>704</strong><span>days<br/>remaining</span></div><div className="preview-progress"><i/></div><div className="preview-expiry"><span>Coverage ends</span><b>12 Sep 2028</b></div><span className="preview-card-action">View warranty <ChevronRight size={12}/></span></div></div><div className="preview-product-card second-product"><div className="preview-product-photo"><img src="/images/kestrel-charge-powerbank.png" alt="Kestrel Charge portable power bank"/></div><div className="preview-product-info"><span className="preview-covered"><i/> Under warranty</span><h4>Kestrel Charge 20K</h4><small>Portable Power Bank · KST-20511</small><div className="preview-days"><strong>681</strong><span>days<br/>remaining</span></div><div className="preview-progress"><i/></div><div className="preview-expiry"><span>Coverage ends</span><b>20 Aug 2028</b></div><span className="preview-card-action">View warranty <ChevronRight size={12}/></span></div></div></div>
      <div className="preview-tracking"><div className="preview-tracking-icon"><Clock3 size={15}/></div><div><small>CLAIM UPDATE · VCH-8F31A2</small><strong>Jamie, your claim is being reviewed.</strong><span>We’ll keep the details and next steps together here.</span></div><span className="preview-tracking-state"><Check size={12}/> In review</span></div>
    </div>
  </div>;
}
