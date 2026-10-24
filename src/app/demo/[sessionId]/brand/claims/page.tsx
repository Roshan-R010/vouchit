import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireBrand } from "@/lib/brand";
import { formatDate, isCoverageActive } from "@/lib/dates";
import { claimStatusLabels, claimStatusOptions, isClaimStatus } from "@/lib/claim-status";
import styles from "@/components/brand-claims.module.css";

export default async function BrandClaimsPage({ params, searchParams }: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { sessionId } = await params;
  const query = await searchParams;
  const brand = await requireBrand(sessionId);
  const search = (query.q || "").trim().slice(0, 100);
  const status = query.status && isClaimStatus(query.status) ? query.status : undefined;
  const scope = { registration: { customer: { demoSessionId: sessionId }, unit: { brandId: brand.id } } };
  const [claims, grouped] = await Promise.all([
    db.warrantyClaim.findMany({
      where: {
        ...scope,
        ...(status ? { status } : {}),
        ...(search ? { OR: [
          { reference: { contains: search, mode: "insensitive" as const } },
          { issueTitle: { contains: search, mode: "insensitive" as const } },
          { registration: { customer: { name: { contains: search, mode: "insensitive" as const } } } },
          { registration: { unit: { serialNumber: { contains: search, mode: "insensitive" as const } } } },
          { registration: { unit: { productModel: { name: { contains: search, mode: "insensitive" as const } } } } },
        ] } : {}),
      },
      include: { registration: { include: { customer: true, unit: { include: { productModel: true } } } } },
      orderBy: { submittedAt: "desc" },
    }),
    db.warrantyClaim.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
  ]);
  const total = grouped.reduce((sum, row) => sum + row._count._all, 0);
  const root = `/demo/${sessionId}/brand/claims`;
  const filterHref = (filter?: string) => {
    const values = new URLSearchParams();
    if (filter) values.set("status", filter);
    if (search) values.set("q", search);
    return values.size ? `${root}?${values}` : root;
  };

  return <div className={styles.page}>
    <header className={styles.pageHeader}><div><span className={styles.eyebrow}>Customer care</span><h1>Claims</h1><p>Every warranty conversation, with the details already attached.</p></div><span className={styles.total}>{total} {total === 1 ? "claim" : "claims"}</span></header>
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <form className={styles.search} action={root}><Search size={16} /><input name="q" aria-label="Search claims" placeholder="Search claims, customers or units" defaultValue={search} />{status && <input type="hidden" name="status" value={status} />}<button type="submit">Search</button></form>
        {search && <Link className={styles.clearLink} href={status ? `${root}?status=${status}` : root}>Clear search</Link>}
      </div>
      <nav className={styles.tabs} aria-label="Filter claims">
        <Link href={filterHref()} className={!status ? styles.activeTab : styles.tab}>All <span>{total}</span></Link>
        {claimStatusOptions.map((value) => <Link key={value} href={filterHref(value)} className={status === value ? styles.activeTab : styles.tab}>{claimStatusLabels[value]}<span>{grouped.find((row) => row.status === value)?._count._all || 0}</span></Link>)}
      </nav>
      {claims.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Claim</th><th>Customer</th><th>Product / Unit</th><th>Issue</th><th>Warranty</th><th>Status</th><th>Submitted</th><th><span className={styles.srOnly}>Open claim</span></th></tr></thead><tbody>{claims.map((claim) => <tr key={claim.id}>
        <td><Link className={styles.claimLink} href={`${root}/${claim.id}`}>{claim.reference}</Link></td>
        <td>{claim.registration.customer.name}</td>
        <td><span className={styles.cellPrimary}>{claim.registration.unit.productModel.name}</span><span className={styles.cellSecondary}>{claim.registration.unit.serialNumber}</span></td>
        <td className={styles.issueCell}><Link href={`${root}/${claim.id}`}>{claim.issueTitle}</Link></td>
        <td><span className={`${styles.badge} ${isCoverageActive(claim.registration.coverageEndsOn) ? styles.covered : styles.neutral}`}>{isCoverageActive(claim.registration.coverageEndsOn) ? "Covered" : "Expired"}</span></td>
        <td><span className={styles.badge} data-status={claim.status}>{claimStatusLabels[claim.status]}</span></td>
        <td className={styles.dateCell}>{formatDate(claim.submittedAt)}</td>
        <td><Link href={`${root}/${claim.id}`} aria-label={`Open ${claim.reference}`} className={styles.openLink}><ArrowUpRight size={16} /></Link></td>
      </tr>)}</tbody></table></div> : <div className={styles.empty}><h2>{search || status ? "No matching claims" : "Your inbox is clear"}</h2><p>{search || status ? "Try another search or select a different status." : "Claims submitted from Customer view will appear here with their product and warranty details."}</p>{(search || status) && <Link href={root} className={styles.secondaryButton}>Show all claims</Link>}</div>}
    </section>
  </div>;
}
