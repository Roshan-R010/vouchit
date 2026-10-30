import { Select } from "@/components/select";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";
import { RegistrationChart } from "@/components/registration-chart";

type Analytics = {
  periodDays: number;
  metrics: { totalRegistrations: number; activeRegistrations: number; totalClaims: number; openClaims: number; approvalRate: number | null; averageResolutionHours: number | null; resolvedClaims: number };
  trend: { label: string; count: number; claims: number }[];
  statusCounts: { status: string; count: number }[];
  issueCounts: { tag: string; count: number; tone: number }[];
  issueTagTotal: number;
  productStats: { id: string; name: string; registrations: number; claims: number; claimRate: number | null; issueCounts: { tag: string; count: number; tone: number }[]; issueTagTotal: number }[];
};

export function AnalyticsView() {
  const { sessionId } = useParams();
  const reducedMotion = useReducedMotion();
  const [days, setDays] = useState(30);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    apiFetch(`/api/demo/${sessionId}/brand/analytics?days=${days}`, refresh ? { cache: "no-store" } : undefined)
      .then(readApiResponse).then(result => { if (active) setData(result); })
      .catch(cause => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionId, days, refresh]);
  const metrics = data?.metrics;
  const selectedProduct = data?.productStats.find(product => product.id === selectedProductId);
  const issueCounts = selectedProduct?.issueCounts ?? data?.issueCounts ?? [];
  const issueTagTotal = selectedProduct?.issueTagTotal ?? data?.issueTagTotal ?? 0;
  const issueClaimCount = selectedProduct?.claims ?? metrics?.totalClaims ?? 0;
  const claimsFilter = selectedProduct ? `?product=${encodeURIComponent(selectedProduct.id)}` : "";
  const cards = metrics ? [
    { title: "Registered products", value: metrics.totalRegistrations, note: `${metrics.activeRegistrations} currently covered` },
    { title: "Warranty claims", value: metrics.totalClaims, note: `${metrics.openClaims} awaiting resolution` },
    { title: "Approval rate", value: metrics.approvalRate === null ? "—" : `${metrics.approvalRate}%`, note: metrics.approvalRate === null ? "No decisions recorded yet" : "Of approved, resolved and rejected claims" },
    { title: "Average resolution", value: metrics.averageResolutionHours === null ? "—" : `${metrics.averageResolutionHours}h`, note: metrics.averageResolutionHours === null ? "No resolved claims yet" : "From submission to recorded resolution" },
  ] : [];
  return <div className="analytics-page" aria-busy={loading}>
    <div className="business-page-header"><div><div className="business-eyebrow">Performance</div><h1>Analytics</h1><p>A clear picture of coverage and aftercare. All figures come from your saved records.</p></div><button className="business-button" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} className={loading ? "business-spin" : ""}/>Refresh</button></div>
    {error && <div className="business-notice error" role="alert">{error}</div>}
    {!data && loading ? <div className="analytics-loading" role="status">Loading your warranty activity…</div> : data && <>
      <div className="analytics-caption">All-time overview</div>
      <div className="analytics-metrics">{cards.map(card => <section key={card.title}><h2>{card.title}</h2><strong>{card.value}</strong><p>{card.note}</p></section>)}</div>
      <div className="analytics-columns">
        <section className="business-panel analytics-trend"><div className="business-panel-header"><div><h2>Registration activity</h2><p>{data.trend.reduce((sum, day) => sum + day.count, 0)} registrations over {data.periodDays} days</p></div><div className="analytics-period" aria-label="Activity date range">{[30, 90].map(value => <button key={value} aria-pressed={days === value} onClick={() => setDays(value)}>{value} days</button>)}</div></div><div className="analytics-chart"><RegistrationChart data={data.trend}/></div></section>
        <motion.section className="business-panel analytics-problems" initial={reducedMotion ? false : { opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <div className="business-panel-header"><div><h2>Problems customers report</h2><p>Top five issues {selectedProduct ? `for ${selectedProduct.name}` : "across all products"}</p></div><label className="analytics-problem-filter"><span className="sr-only">Filter reported problems by product</span><Select value={selectedProduct?.id ?? ""} onChange={event => setSelectedProductId(event.target.value)}><option value="">All products</option>{data.productStats.map(product => <option value={product.id} key={product.id}>{product.name}</option>)}</Select></label></div>
          {issueCounts.length ? <div className="analytics-problem-list">
            {issueCounts.map((item, index) => <motion.div className="analytics-problem-row" data-tone={item.tone} key={`${selectedProduct?.id ?? "all"}:${item.tag}`} initial={reducedMotion ? false : { opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: reducedMotion ? 0 : 0.1 + index * 0.06 }}>
              <div className="analytics-problem-heading"><Link className="analytics-problem-tag" to={`/demo/${sessionId}/brand/claims?${selectedProduct ? `product=${encodeURIComponent(selectedProduct.id)}&` : ""}tag=${encodeURIComponent(item.tag)}`}><span className="analytics-problem-dot" aria-hidden="true"/>{item.tag}</Link><strong aria-label={`${item.count} claims`}>{item.count}</strong></div>
              <div className="analytics-problem-track"><motion.span initial={reducedMotion ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.65, delay: reducedMotion ? 0 : 0.25 + index * 0.08, ease: [0.22, 1, 0.36, 1] }} style={{ width: `${issueClaimCount ? item.count / issueClaimCount * 100 : 0}%`, transformOrigin: "left" }}/></div>
            </motion.div>)}
            {issueTagTotal > issueCounts.length && <Link className="analytics-problem-more" to={`/demo/${sessionId}/brand/claims${claimsFilter}`}>View all reported issues <ArrowUpRight size={14}/></Link>}
          </div> : <div className="analytics-problem-empty">No problems reported {selectedProduct ? `for ${selectedProduct.name}` : "across your products"} yet.</div>}
        </motion.section>
      </div>
      <section className="business-panel"><div className="business-panel-header"><div><h2>By product</h2><p>Claims as a share of registered units, across all time.</p></div><Link className="business-text-link" to={`/demo/${sessionId}/brand/products`}>View products <ArrowUpRight size={16}/></Link></div><div className="business-table-wrap"><table className="business-table"><thead><tr><th>Product</th><th>Registered units</th><th>Claims</th><th>Claim rate</th></tr></thead><tbody>{data.productStats.map(product => <tr key={product.id}><td><Link className="business-row-link" to={`/demo/${sessionId}/brand/products/${product.id}`}>{product.name}</Link></td><td>{product.registrations}</td><td>{product.claims}</td><td>{product.claimRate === null ? <span className="business-muted">No registrations</span> : `${product.claimRate}%`}</td></tr>)}</tbody></table>{!data.productStats.length && <div className="business-empty">Add your first product to start tracking warranty activity.</div>}</div></section>
    </>}
  </div>;
}
