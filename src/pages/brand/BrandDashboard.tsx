import { useEffect, useId, useMemo, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Bell, Package } from "lucide-react";
import { Select } from "@/components/select";
import { ProductPhoto } from "@/components/product-photo";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";
import { formatDate } from "@/lib/dates";
import { inboxStatusLabels } from "@/components/claim-inbox-status";
import styles from "./brand-dashboard.module.css";

type Point = { date: string; label: string; count: number };
type Issue = { tag: string; count: number; tone: number };
type BrandNotification = { id: string; subject: string; previewBody: string; relatedId: string | null; createdAt: string };
type DashboardData = {
  brand: { name: string };
  periodDays: 7 | 30 | 90;
  metrics: { totalRegistrations: number; openClaimsCount: number; needsReviewCount: number; productsCount: number; expiringSoonCount: number; missingDetailsCount: number; resolvedThisWeek: number; periodRegistrations: number; periodClaims: number };
  chartData: Point[];
  claimSeries: Point[];
  expirationSeries: Point[];
  products: { id: string; name: string }[];
  issues: { issueCounts: Issue[]; issueCountTotal: number; byProduct: { productId: string; issueCounts: Issue[]; issueCountTotal: number }[] };
  recentClaims: { id: string; reference: string; status: string; submittedAt: string; customer: { name: string; email: string }; unit: { serialNumber: string; productModel: { name: string; imageUrl: string | null } } }[];
};
const ranges = [7, 30, 90] as const;
const issueColors = ["#b4e5c1", "#b8de70", "#ffe07a", "#ffb16b", "#ff7f94", "#c8b5ed"];
const longDate = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

function TrendChart({ data, color, compact = false, label, unavailable = false }: { data: Point[]; color: string; compact?: boolean; label: string; unavailable?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const gradientId = useId().replace(/:/g, "");
  const width = compact ? 120 : 720;
  const top = compact ? 8 : 19;
  const bottom = compact ? 55 : 174;
  const { max, points, path } = useMemo(() => {
    const maximum = Math.max(1, ...data.map(point => point.count));
    const points = data.map((point, index) => ({
      x: 7 + index * (width - 14) / Math.max(1, data.length - 1),
      y: bottom - point.count / maximum * (bottom - top),
    }));
    const path = points.map((point, index) => {
      if (!index) return `M ${point.x} ${point.y}`;
      const before = points[index - 1];
      const mid = (before.x + point.x) / 2;
      return `C ${mid} ${before.y}, ${mid} ${point.y}, ${point.x} ${point.y}`;
    }).join(" ");
    return { max: maximum, points, path };
  }, [data, width, bottom, top]);
  const pointer = (event: PointerEvent<SVGSVGElement>) => {
    if (unavailable || !data.length) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    setActive(Math.round(ratio * (data.length - 1)));
  };
  const shown = active !== null ? data[active] : null;
  return <div className={`${styles.trend} ${compact ? styles.sparkline : styles.mainTrend}`}>
    {!compact && <div className={styles.yAxis}>{[max, max >= 2 ? Math.round(max / 2) : "", 0].map((value, index) => <span key={index}>{value}</span>)}</div>}
    <div className={styles.trendPlot}>
      <svg viewBox={`0 0 ${width} ${compact ? 64 : 188}`} preserveAspectRatio="none" role="img" tabIndex={unavailable ? -1 : 0} aria-label={`${label}: ${data.reduce((sum, point) => sum + point.count, 0)} events across ${data.length} days`} onPointerMove={pointer} onPointerLeave={() => setActive(null)} onBlur={() => setActive(null)} onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); setActive(index => Math.max(0, Math.min(data.length - 1, (index ?? 0) + (event.key === "ArrowRight" ? 1 : -1)))); } }}>
        <defs><linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1"><stop stopColor={color} stopOpacity={compact ? ".19" : ".2"}/><stop offset="1" stopColor={color} stopOpacity="0"/></linearGradient></defs>
        {!compact && [19, 96, 174].map(value => <line key={value} x1="7" x2={width - 7} y1={value} y2={value} stroke="#e8edf4" strokeDasharray="4 4"/>)}
        {points.length > 0 && <><path d={`${path} L ${points.at(-1)!.x} ${bottom} L 7 ${bottom} Z`} fill={`url(#${gradientId})`}/><path d={path} fill="none" stroke={color} strokeWidth={compact ? 2.1 : 2.7} strokeLinecap="round" vectorEffect="non-scaling-stroke"/></>}
        {active !== null && points[active] && <><line x1={points[active].x} x2={points[active].x} y1={top} y2={bottom} stroke={color} strokeOpacity=".32" strokeDasharray="4 4"/><circle cx={points[active].x} cy={points[active].y} r={compact ? 3 : 4} fill={color} stroke="#fff" strokeWidth="2"/></>}
      </svg>
      {shown && <div className={styles.chartTooltip} style={{ left: `${Math.max(12, Math.min(82, active! / Math.max(1, data.length - 1) * 100))}%` }}><strong>{longDate(shown.date)}</strong><span>{shown.count} {label.toLowerCase()}</span></div>}
      {unavailable && <span className={styles.unavailable}>History unavailable</span>}
      {!compact && <div className={styles.xAxis}>{[0, .25, .5, .75, 1].map(fraction => { const point = data[Math.round(fraction * (data.length - 1))]; return <span key={fraction}>{point?.label}</span>; })}</div>}
    </div>
  </div>;
}

function IssueGauge({ issues, total }: { issues: Issue[]; total: number }) {
  const [active, setActive] = useState<number | null>(null);
  let offset = 0;
  const point = (angle: number) => ({ x: 140 + 108 * Math.cos(angle * Math.PI / 180), y: 139 + 108 * Math.sin(angle * Math.PI / 180) });
  const arc = (start: number, end: number) => { const a = point(start), b = point(end); return `M ${a.x} ${a.y} A 108 108 0 ${end - start > 180 ? 1 : 0} 1 ${b.x} ${b.y}`; };
  return <div className={styles.gaugeWrap}>
    <svg viewBox="0 0 280 160" role="img" aria-label={`${total} reported issues across ${issues.length} categories`}>
      <path d={arc(180, 360)} fill="none" stroke="#edf0f6" strokeWidth="31" strokeLinecap="round"/>
      {issues.map((issue, index) => {
        const start = 180 + offset / total * 180;
        offset += issue.count;
        const end = 180 + offset / total * 180;
        return <path key={issue.tag} d={arc(start + (index ? 1.2 : 0), end - (index < issues.length - 1 ? 1.2 : 0))} fill="none" stroke={issueColors[index % issueColors.length]} strokeWidth={active === index ? 35 : 31} strokeLinecap={issues.length === 1 ? "round" : "butt"} tabIndex={0} role="button" aria-label={`${issue.tag}: ${issue.count} reported issues, ${Math.round(issue.count / total * 100)} percent`} onPointerEnter={() => setActive(index)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(index)} onBlur={() => setActive(null)}/>;
      })}
    </svg>
    <div className={styles.gaugeCenter}><strong>{active === null ? total : issues[active]?.count}</strong><span>{active === null ? "Total issues" : issues[active]?.tag}</span></div>
    {active !== null && issues[active] && <div className={styles.gaugeTooltip}><strong>{issues[active].tag}</strong><span>{issues[active].count} reported · {Math.round(issues[active].count / total * 100)}%</span></div>}
  </div>;
}

export function BrandDashboard() {
  const { sessionId } = useParams();
  const [data, setData] = useState<DashboardData | null>(null);
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [productId, setProductId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<BrandNotification[] | null>(null);
  const [notificationsError, setNotificationsError] = useState("");
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    setLoading(true); setError("");
    apiFetch(`/api/demo/${sessionId}/brand?days=${period}`, retry ? { cache: "no-store" } : undefined)
      .then(readApiResponse).then(result => { if (active) setData(result); })
      .catch(cause => { if (active) setError(cause.message || "Could not load your dashboard."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionId, period, retry]);
  useEffect(() => { const refresh = () => { setNotifications(null); setRetry(value => value + 1); }; window.addEventListener("vouch:data-changed", refresh); return () => window.removeEventListener("vouch:data-changed", refresh); }, []);
  const toggleNotifications = () => {
    setNotificationsOpen(value => !value);
    if (notificationsOpen || notifications !== null || notificationsLoading || !sessionId) return;
    setNotificationsLoading(true);
    setNotificationsError("");
    apiFetch(`/api/demo/${sessionId}/brand/notifications`, { cache: "no-store" }).then(readApiResponse)
      .then(result => setNotifications(result.notifications))
      .catch(() => setNotificationsError("Could not load notifications."))
      .finally(() => setNotificationsLoading(false));
  };
  const base = `/demo/${sessionId}/brand`;
  const topbarTarget = document.getElementById("brand-dashboard-topbar-controls");
  const topbarControls = topbarTarget && createPortal(<div className={styles.controlActions}><Select aria-label="Dashboard date range" value={period} onChange={event => setPeriod(Number(event.target.value) as 7 | 30 | 90)}>{ranges.map(value => <option key={value} value={value}>Last {value} days</option>)}</Select>
    <div className={styles.notificationWrap}><button type="button" className={styles.bell} aria-label="Brand notifications" aria-expanded={notificationsOpen} onClick={toggleNotifications}><Bell size={18}/>{(data?.metrics.needsReviewCount ?? 0) > 0 && <i aria-hidden="true"/>}</button>{notificationsOpen && <div className={styles.notificationPanel}><strong>Notifications</strong>{notificationsLoading ? <p>Loading notifications…</p> : notificationsError ? <p role="alert">{notificationsError}</p> : notifications?.length ? notifications.map(item => <Link key={item.id} to={item.relatedId ? `${base}/claims/${item.relatedId}` : `${base}/claims`} onClick={() => setNotificationsOpen(false)}><b>{item.subject}</b><small>{item.previewBody.replace(/Preview.*not sent\./, "").trim()}</small></Link>) : <p>No notifications yet.</p>}</div>}</div>
  </div>, topbarTarget);
  if (!data) return <>{topbarControls}<div className={styles.skeleton} role={error ? "alert" : "status"}>{error ? <><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></> : <><div/><section><div/><div/></section><section><div/><div/></section></>}</div></>;
  const { metrics } = data;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const selectedProduct = data.products.find(product => product.id === productId);
  const issueSet = data.issues.byProduct.find(item => item.productId === productId) || data.issues;
  const issues = issueSet.issueCountTotal > issueSet.issueCounts.reduce((sum, issue) => sum + issue.count, 0) ? [...issueSet.issueCounts.slice(0, 4), { tag: "Other", count: issueSet.issueCountTotal - issueSet.issueCounts.slice(0, 4).reduce((sum, issue) => sum + issue.count, 0), tone: 4 }] : issueSet.issueCounts;
  const totalIssues = issueSet.issueCountTotal;
  const zeroSeries = data.chartData.map(point => ({ ...point, count: 0 }));
  const cards = [
    { label: "Registered units", value: metrics.totalRegistrations, note: `${metrics.periodRegistrations} added in last ${period} days`, color: "#62c98a", series: data.chartData, event: "new registrations", href: `${base}/registrations` },
    { label: "Open claims", value: metrics.openClaimsCount, note: `${metrics.resolvedThisWeek} resolved this week`, color: "#ff946f", series: data.claimSeries, event: "new claims", href: `${base}/claims?status=open` },
    { label: "Expiring soon", value: metrics.expiringSoonCount, note: "Within the next 30 days", color: "#819aef", series: data.expirationSeries, event: "warranties expiring", href: `${base}/registrations?filter=expiring` },
    { label: "Products in catalog", value: metrics.productsCount, note: "All product models", color: "#b477ff", series: zeroSeries, event: "product additions", href: `${base}/products`, unavailable: true },
  ];
  const attention = [
    { count: metrics.needsReviewCount, text: metrics.needsReviewCount === 1 ? "claim awaiting review" : "claims awaiting review", note: "Awaiting your decision", action: "View claims", href: `${base}/claims?status=needs_review` },
    { count: metrics.expiringSoonCount, text: "warranties expiring in 30 days", note: "Coverage ending soon", action: "View warranties", href: `${base}/registrations?filter=expiring` },
    { count: metrics.missingDetailsCount, text: "registrations missing details", note: "Incomplete customer information", action: "View registrations", href: `${base}/registrations?filter=missing_details` },
  ];
  return <div className={styles.dashboard} aria-busy={loading}>
    {topbarControls}
    {error && <div className={styles.error} role="alert">{error}<button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
    <section className={styles.hero} aria-label="Warranty summary"><div className={styles.heroIntro}><span>DASHBOARD</span><h1>{greeting}, {data.brand.name}</h1><p>Here's what's happening with your warranties today.</p></div>
      <div className={styles.metrics}>{cards.map(card => <article key={card.label} className={styles.metric} style={{ "--spark-color": card.color } as React.CSSProperties}><Link to={card.href} className={styles.metricLabel}>{card.label}<ArrowRight size={14}/></Link><strong>{card.value.toLocaleString()}</strong><p>{card.note}</p><TrendChart data={card.series} color={card.color} compact label={card.event} unavailable={card.unavailable}/></article>)}</div>
    </section>
    <div className={styles.middle}>
      <section className={styles.panel} aria-labelledby="registrations-overview"><div className={styles.panelHead}><div><h2 id="registrations-overview">Registrations overview</h2><p>{metrics.periodRegistrations} registrations in the last {period} days</p></div><span className={styles.periodPill}>Last {period} days</span></div><TrendChart data={data.chartData} color="#5577ff" label="registrations"/></section>
      <section className={`${styles.panel} ${styles.attention} ${metrics.needsReviewCount > 0 ? styles.urgent : ""}`} aria-labelledby="attention-heading"><div className={styles.panelHead}><h2 id="attention-heading">Needs your attention</h2><Link to={`${base}/claims?status=needs_review`} className={styles.circleArrow} aria-label="Review claims"><ArrowRight size={17}/></Link></div><div className={styles.attentionList}>{attention.map((item, index) => <div className={styles.attentionRow} key={item.action}><strong data-tone={index}>{item.count}</strong><div><b>{item.text}</b><small>{item.note}</small></div><Link to={item.href}>{item.action}<ArrowRight size={16}/></Link></div>)}</div></section>
    </div>
    <div className={styles.bottom}>
      <section className={styles.panel} aria-labelledby="issues-heading"><div className={styles.panelHead}><div><h2 id="issues-heading">Customer issues</h2><p>Top issues reported {selectedProduct ? `for ${selectedProduct.name}` : "across all products"}</p></div><Select aria-label="Filter customer issues by product" value={productId} onChange={event => setProductId(event.target.value)}><option value="">All products</option>{data.products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</Select></div><div className={styles.issueBody}><IssueGauge issues={issues} total={totalIssues}/><div className={styles.legend}>{issues.length ? issues.map((issue, index) => <Link key={issue.tag} to={`${base}/claims?${selectedProduct ? `product=${encodeURIComponent(selectedProduct.id)}&` : ""}${issue.tag === "Other" ? "" : `tag=${encodeURIComponent(issue.tag)}`}`}><i style={{ background: issueColors[index % issueColors.length] }}/><span>{issue.tag}</span><strong>{issue.count}</strong></Link>) : <p>No customer issues reported yet.</p>}</div></div></section>
      <section className={styles.panel} aria-labelledby="recent-claims"><div className={styles.panelHead}><h2 id="recent-claims">Recent claims</h2><Link to={`${base}/claims`} className={styles.viewAll}>View all <ArrowRight size={16}/></Link></div>{data.recentClaims.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Product</th><th>Customer</th><th>Date</th><th>Status</th></tr></thead><tbody>{data.recentClaims.map(claim => <tr key={claim.id}><td><Link to={`${base}/claims/${claim.id}`} className={styles.productCell}><span className={styles.photo}>{claim.unit.productModel.imageUrl ? <ProductPhoto src={claim.unit.productModel.imageUrl} alt=""/> : <Package size={19}/>}</span><span><b>{claim.unit.productModel.name}</b><small>ID: {claim.unit.serialNumber}</small></span></Link></td><td><b>{claim.customer.name}</b><small>{claim.customer.email}</small></td><td><time dateTime={claim.submittedAt}>{formatDate(claim.submittedAt)}</time></td><td><span className={styles.status} data-status={claim.status}>{inboxStatusLabels[claim.status] || claim.status}</span></td></tr>)}</tbody></table></div> : <div className={styles.empty}><strong>No claims yet</strong><p>Customer warranty claims will appear here.</p></div>}</section>
    </div>
  </div>;
}
export default BrandDashboard;
