import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { LandingHero } from "@/components/landing-hero";
import { LandingShowcase } from "@/components/landing-showcase";

const stories = [
  { number: "01", title: "NO MORE GOOGLE FORMS", copy: "Make registration feel like a natural part of owning something well made.", art: "form", color: "peach" },
  { number: "02", title: "STOP CHECKING ORDERS BY HAND", copy: "Connect each stamped unit ID to its product and delivery record.", art: "link", color: "sage" },
  { number: "03", title: "EVERY WARRANTY, ACCOUNTED FOR", copy: "Give every customer a clear view of what is covered and for how long.", art: "shield", color: "blue" },
  { number: "04", title: "CLAIMS IN ONE PLACE", copy: "Keep the product, issue, warranty and decision together from the start.", art: "claim", color: "cream" },
  { number: "05", title: "CUSTOMERS KNOW WHAT’S NEXT", copy: "Let customers follow progress on the same page where they raised the claim.", art: "path", color: "lavender" },
];

export default function Home() {
  return <main className="landing-page">
    <LandingHero/>
    <LandingShowcase/>
    <section className="landing-stories" id="stories">
      <div className="landing-stories-inner"><div className="landing-section-intro"><span className="landing-kicker">The little things, handled</span><h2>Good aftercare<br/><em>makes a good product.</em></h2><p>Make the moments after checkout feel as considered as the product itself.</p></div>
        <div className="story-grid">{stories.map((story) => <article key={story.number} className={`story-card ${story.color}`}><div className="story-card-top"><span>{story.number} / 05</span><span>VOUCH CARE</span></div><StoryDrawing kind={story.art}/><h3>{story.title}</h3><p>{story.copy}</p></article>)}</div>
      </div>
    </section>
    <section className="landing-bottom-cta" id="how-it-works"><div className="bottom-cta-mark">V</div><span className="landing-kicker">A better warranty experience starts here</span><h2>Make the next step<br/>feel <em>thought through.</em></h2><p>Try the connected customer and brand experience with fictional demo records.</p><div className="bottom-cta-actions"><Link className="hero-primary" href="/demo" prefetch={false}>Launch interactive demo <ArrowRight size={16}/></Link><Link className="bottom-cta-link" href="/demo?view=brand" prefetch={false}>Explore the brand side <ArrowUpRight size={15}/></Link></div><small>Fictional records for product demonstration only. No emails are sent.</small></section>
    <footer className="landing-footer"><Link className="landing-logo" href="/"><span>V</span>vouch</Link><span>Product care, made clear.</span><span>© Vouch demo</span></footer>
  </main>;
}

function StoryDrawing({ kind }: { kind: string }) {
  return <div className={`story-drawing drawing-${kind}`} aria-hidden="true"><svg viewBox="0 0 220 150" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    {kind === "form" && <><path d="M63 23h78l24 24v79H63z"/><path d="M141 23v25h24M78 65h70M78 81h54M78 97h65"/><path d="m135 105 8 8 17-21"/><path d="M43 38c-9 9-13 19-13 31M39 104c5 11 13 18 24 23" strokeDasharray="3 6"/></>}
    {kind === "link" && <><rect x="18" y="50" width="49" height="49" rx="4"/><path d="M30 63h23M30 74h16M30 85h20"/><path d="M67 75h28m0 0-9-9m9 9-9 9"/><rect x="95" y="50" width="49" height="49" rx="4"/><path d="M108 62h23M108 73h17M108 84h21"/><path d="M144 75h25"/><path d="m164 68 9 7-9 7"/><path d="M174 45c10 8 14 18 14 30s-5 25-17 34" strokeDasharray="3 6"/></>}
    {kind === "shield" && <><path d="M110 20 161 39v34c0 30-19 48-51 61-32-13-51-31-51-61V39z"/><path d="m87 75 15 15 31-34"/><path d="M31 42c8-10 18-16 31-20M43 118c9 8 19 13 31 16M178 48c7 10 11 22 11 36" strokeDasharray="3 6"/></>}
    {kind === "claim" && <><rect x="52" y="25" width="91" height="103" rx="5" transform="rotate(-5 52 25)"/><path d="m73 49 46-4M74 65l57-5M76 80l40-4"/><rect x="104" y="76" width="79" height="53" rx="5"/><circle cx="118" cy="92" r="4"/><path d="M130 92h39M116 105h51"/><path d="M37 47c-8 8-12 18-12 31s5 23 15 31" strokeDasharray="3 6"/></>}
    {kind === "path" && <><path d="M43 102h133"/><circle cx="50" cy="102" r="12"/><circle cx="109" cy="102" r="12"/><circle cx="168" cy="102" r="12"/><path d="M47 102l3 3 5-6M105 102l3 3 5-6"/><rect x="83" y="28" width="53" height="43" rx="5"/><path d="M93 42h33M93 52h20M109 71v18M50 88V59h33M168 88V59h-32" strokeDasharray="3 5"/><path d="m161 53 7 7 7-7"/></>}
  </svg></div>;
}
