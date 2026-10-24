import { VouchLogo } from "@/components/vouch-logo";
import { ProductPhoto } from "@/components/product-photo";
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
    <header className="landing-nav"><Link className="landing-logo" href="/" aria-label="Vouch home"><VouchLogo /></Link><nav aria-label="Main navigation"><a href="#product">Product</a><a href="#stories">Why Vouch</a><a href="#how-it-works">How it works</a></nav><Link className="landing-nav-cta" href="/demo?view=brand" prefetch={false}>Open workspace <ArrowUpRight size={15}/></Link></header>
    <div className="landing-hero-content"><motion.div className="hero-copyline" initial={reducedMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55, ease: "easeOut" }}><span className="hero-eyebrow"><i/> PRODUCT CARE, MADE CLEAR</span><h1>Great products<br/>deserve <em>better care.</em></h1><p>Warranty registration, coverage and support finally feel like one experience.</p><div className="hero-actions"><Link className="hero-primary" href="/demo" prefetch={false}>Open customer portal <ArrowRight size={16}/></Link><a className="hero-secondary" href="#product">Explore Vouch <ArrowDown size={15}/></a></div><div className="hero-proof"><span><i/> Connected product care</span><span><i/> Brand & customer portals</span><span><i/> Your warranty records</span></div></motion.div>
      <motion.div className="hero-product-stage" aria-hidden="true" style={{ y: reducedMotion ? 0 : artworkY }}>
        <span className="hero-orbit orbit-one"/><span className="hero-orbit orbit-two"/><span className="hero-ribbon"/>
        <div className="hero-headphones"><ProductPhoto src="/images/jb-air-products.png#xywh=43,36,108,161" alt="JB Air AIR400"/></div><div className="hero-powerbank"><ProductPhoto src="/images/jb-air-products.png#xywh=43,239,108,161" alt="JB Air AIR800"/></div>
        <span className="hero-product-label label-headphones"><b/> AIR400 <small>JB AIR</small></span><span className="hero-product-label label-power"><b/> AIR800 <small>JB AIR</small></span>
      </motion.div>
    </div>
    <a className="hero-scroll-cue" href="#product"><span>SCROLL TO EXPLORE</span><i><ArrowDown size={13}/></i></a>
  </section>;
}
