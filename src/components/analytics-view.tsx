import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";
import { RegistrationChart } from "@/components/registration-chart";

type Analytics = {
  periodDays: number;
  metrics: { totalRegistrations: number; activeRegistrations: number; totalClaims: number; openClaims: number; approvalRate: number | null; averageResolutionHours: number | null; resolvedClaims: number };
  trend: { label: string; count: number; claims: number }[];
  statusCounts: { status: string; count: number }[];
  productStats: { id: string; name: string; registrations: number; claims: number; claimRate: number | null }[];
};
const labels: Record<string, string> = { SUBMITTED: "Submitted", UNDER_REVIEW: "Under review", INFO_REQUESTED: "Waiting for customer", APPROVED: "Approved", REJECTED: "Rejected", RESOLVED: "Resolved" };

export function AnalyticsView() {
  const { sessionId } = useParams();
  const [days, setDays] = useState(30);
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
        <section className="business-panel"><div className="business-panel-header"><div><h2>Where claims stand</h2><p>Current status of every claim</p></div></div><div className="analytics-statuses">{data.statusCounts.map(item => <div key={item.status}><div className="analytics-status-label"><span>{labels[item.status]}</span><strong>{item.count}</strong></div><div className="analytics-status-track"><span style={{ width: `${metrics!.totalClaims ? item.count / metrics!.totalClaims * 100 : 0}%` }}/></div></div>)}</div></section>
      </div>
      <section className="business-panel"><div className="business-panel-header"><div><h2>By product</h2><p>Claims as a share of registered units, across all time.</p></div><Link className="business-text-link" to={`/demo/${sessionId}/brand/products`}>View products <ArrowUpRight size={16}/></Link></div><div className="business-table-wrap"><table className="business-table"><thead><tr><th>Product</th><th>Registered units</th><th>Claims</th><th>Claim rate</th></tr></thead><tbody>{data.productStats.map(product => <tr key={product.id}><td><Link className="business-row-link" to={`/demo/${sessionId}/brand/products/${product.id}`}>{product.name}</Link></td><td>{product.registrations}</td><td>{product.claims}</td><td>{product.claimRate === null ? <span className="business-muted">No registrations</span> : `${product.claimRate}%`}</td></tr>)}</tbody></table>{!data.productStats.length && <div className="business-empty">Add your first product to start tracking warranty activity.</div>}</div></section>
    </>}
  </div>;
}
