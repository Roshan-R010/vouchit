import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Clock3, Inbox, Package, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";
import { formatDate } from "@/lib/dates";
import { ProductPhoto } from "@/components/product-photo";
import { RegistrationChart } from "@/components/registration-chart";
import styles from "./brand-dashboard.module.css";

type DashboardData = {
  brand: { name: string };
  periodDays: number;
  metrics: { totalRegistrations: number; openClaimsCount: number; needsReviewCount: number; productsCount: number; expiringSoonCount: number; missingDetailsCount: number };
  chartData: { label: string; count: number }[];
  recentRegistrations: { id: string; registeredAt: string; customer: { name: string; email: string }; unit: { serialNumber: string; productModel: { id: string; name: string; imageUrl: string | null } } }[];
};

export function BrandDashboard() {
  const { sessionId } = useParams();
  const [data, setData] = useState<DashboardData | null>(null);
  const [period, setPeriod] = useState<30 | 90>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    setLoading(true); setError("");
    apiFetch(`/api/demo/${sessionId}/brand?days=${period}`, retry ? { cache: "no-store" } : undefined)
      .then(readApiResponse)
      .then(result => { if (active) setData(result); })
      .catch(cause => { if (active) setError(cause.message || "Could not load your dashboard."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionId, period, retry]);

  if (!data) return <div className={styles.loading} role={error ? "alert" : "status"}>{error || "Loading your dashboard…"}{error && <button className="business-button" onClick={() => setRetry(value => value + 1)}>Try again</button>}</div>;
  const base = `/demo/${sessionId}/brand`;
  const { metrics } = data;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const cards = [
    { label: "Registered units", value: metrics.totalRegistrations, note: "Total warranty registrations", icon: ShieldCheck, href: `${base}/registrations` },
    { label: "Open claims", value: metrics.openClaimsCount, note: "Submitted or being processed", icon: Inbox, href: `${base}/claims?status=open` },
    { label: "Expiring soon", value: metrics.expiringSoonCount, note: "Coverage ending within 30 days", icon: Clock3, href: `${base}/registrations?filter=expiring` },
    { label: "Catalog models", value: metrics.productsCount, note: "Products in your catalog", icon: Package, href: `${base}/products` },
  ];
  const attention = [
    { count: metrics.needsReviewCount, text: metrics.needsReviewCount === 1 ? "claim awaiting review" : "claims awaiting review", link: "View claims", href: `${base}/claims?status=needs_review`, icon: Inbox },
    { count: metrics.expiringSoonCount, text: metrics.expiringSoonCount === 1 ? "warranty expiring in 30 days" : "warranties expiring in 30 days", link: "View warranties", href: `${base}/registrations?filter=expiring`, icon: Clock3 },
    { count: metrics.missingDetailsCount, text: metrics.missingDetailsCount === 1 ? "registration missing details" : "registrations missing details", link: "View registrations", href: `${base}/registrations?filter=missing_details`, icon: ClipboardList },
  ];
  const needsAttention = attention.some(item => item.count > 0);
  return <div className={styles.dashboard}>
    <header className={styles.heading}>
      <div><h1>{greeting}, {data.brand.name}</h1><p>Here's what needs your attention today.</p></div>
      <span className={styles.date}><CalendarDays size={16}/><time dateTime={new Date().toLocaleDateString("en-CA")}>{new Date().toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}</time></span>
    </header>
    {error && <div className="business-notice error" role="alert">{error} <button className="business-button small" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
    <section className={styles.metrics} aria-label="Warranty summary">
      {cards.map(({ label, value, note, icon: Icon, href }) => <Link key={label} to={href} className={styles.metric}>
        <span className={styles.metricLabel}><span className={styles.icon}><Icon size={17}/></span>{label}</span>
        <strong>{value.toLocaleString()}</strong><span className={styles.metricNote}>{note}</span>
      </Link>)}
    </section>
    <div className={styles.overview}>
      <section className={styles.panel} aria-labelledby="warranty-overview">
        <div className={styles.panelHeading}><h2 id="warranty-overview">Warranty overview</h2><select aria-label="Warranty overview period" value={period} onChange={event => setPeriod(Number(event.target.value) as 30 | 90)}><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></div>
        <div className={styles.chart} aria-busy={loading}><p className={styles.chartCaption}>{loading ? "Updating activity…" : `${data.chartData.reduce((sum, day) => sum + day.count, 0).toLocaleString()} registrations in the last ${data.periodDays} days`}</p><RegistrationChart data={data.chartData} color="#729cf2" height={204} periodDays={data.periodDays} labelCount={5}/></div>
      </section>
      <section className={`${styles.panel} ${styles.attention} ${needsAttention ? styles.attentionNeeded : ""}`} aria-labelledby="attention-heading">
        <div className={styles.panelHeading}><h2 id="attention-heading">Needs your attention</h2>{!needsAttention && <CheckCircle2 size={18} aria-label="All caught up"/>}</div>
        <div className={styles.attentionList}>{attention.map(({ count, text, link, href, icon: Icon }) => <div key={link} className={styles.attentionRow}>
          <span className={styles.icon}><Icon size={17}/></span><p><strong>{count}</strong> {text}</p><Link to={href}>{link}<ArrowRight size={14}/></Link>
        </div>)}</div>
        <p className={styles.attentionNote}>{needsAttention ? "Review these items to keep your aftercare moving." : "You're all caught up. New items will appear here."}</p>
      </section>
    </div>
    <section className={styles.panel} aria-labelledby="recent-registrations">
      <div className={styles.panelHeading}><h2 id="recent-registrations">Recent registrations</h2><Link to={`${base}/registrations`} className={styles.viewAll}>View all<ArrowRight size={15}/></Link></div>
      {data.recentRegistrations.length ? <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th>Product</th><th>Customer</th><th>Date</th><th>Status</th></tr></thead>
        <tbody>{data.recentRegistrations.map(registration => <tr key={registration.id}>
          <td><Link className={styles.product} to={`${base}/products/${registration.unit.productModel.id}`}><span className={styles.photo}>{registration.unit.productModel.imageUrl ? <ProductPhoto src={registration.unit.productModel.imageUrl} alt={registration.unit.productModel.name}/> : <Package size={21}/>}</span><span><strong>{registration.unit.productModel.name}</strong><small>{registration.unit.serialNumber}</small></span></Link></td>
          <td><strong>{registration.customer.name}</strong><small>{registration.customer.email}</small></td>
          <td><time dateTime={registration.registeredAt}>{formatDate(registration.registeredAt)}</time></td>
          <td><span className={styles.registered}>Registered</span></td>
        </tr>)}</tbody>
      </table></div> : <div className={styles.empty}><ShieldCheck size={26}/><h3>No registrations yet</h3><p>Customer warranty registrations will appear here as they come in.</p><Link to={`${base}/products`}>View your products<ArrowRight size={15}/></Link></div>}
    </section>
  </div>;
}
export default BrandDashboard;
