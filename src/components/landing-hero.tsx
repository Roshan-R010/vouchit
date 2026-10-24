"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";

export function LandingHero() {
  const heroRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const glowOpacity = useTransform(scrollYProgress, [0, .72, 1], [1, .55, 0]);
  const artworkY = useTransform(scrollYProgress, [0, 1], [0, 70]);

  return <section className="landing-hero" ref={heroRef}>
    <motion.div className="hero-ambient" aria-hidden="true" style={{ opacity: reducedMotion ? .6 : glowOpacity }}/>
    <header className="landing-nav"><Link className="landing-logo" href="/" aria-label="Vouch home"><span>V</span>vouch</Link><nav aria-label="Main navigation"><a href="#product">Product</a><a href="#stories">Why Vouch</a><a href="#how-it-works">How it works</a></nav><Link className="landing-nav-cta" href="/demo?view=brand" prefetch={false}>Open demo <ArrowUpRight size={15}/></Link></header>
    <div className="landing-hero-content"><motion.div className="hero-copyline" initial={reducedMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55, ease: "easeOut" }}><span className="hero-eyebrow"><i/> PRODUCT CARE, MADE CLEAR</span><h1>Great products<br/>deserve <em>better care.</em></h1><p>Warranty registration, coverage and support finally feel like one experience.</p><div className="hero-actions"><Link className="hero-primary" href="/demo" prefetch={false}>See the demo <ArrowRight size={16}/></Link><a className="hero-secondary" href="#product">Explore Vouch <ArrowDown size={15}/></a></div><div className="hero-proof"><span><i/> No account needed</span><span><i/> Try both sides</span><span><i/> Fictional demo data</span></div></motion.div>
      <motion.div className="hero-product-stage" aria-hidden="true" style={{ y: reducedMotion ? 0 : artworkY }}>
        <span className="hero-orbit orbit-one"/><span className="hero-orbit orbit-two"/><span className="hero-ribbon"/>
        <img className="hero-headphones" src="/images/kestrel-pro-headphones.png" alt=""/><img className="hero-powerbank" src="/images/kestrel-charge-powerbank.png" alt=""/>
        <span className="hero-product-label label-headphones"><b/> KESTREL PRO <small>HEADPHONES</small></span><span className="hero-product-label label-power"><b/> KESTREL CHARGE <small>20K POWER BANK</small></span>
      </motion.div>
    </div>
    <a className="hero-scroll-cue" href="#product"><span>SCROLL TO EXPLORE</span><i><ArrowDown size={13}/></i></a>
  </section>;
}
