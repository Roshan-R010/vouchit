import { useEffect, useState } from "react";
import { ArrowRight, LifeBuoy } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";
import { ClaimStatusBadge } from "@/components/claim-status-badge";
import { ProductPhoto } from "@/components/product-photo";
import { formatDate } from "@/lib/dates";

type CustomerClaim = {
  id: string;
  reference: string;
  issueTitle: string;
  status: string;
  submittedAt: string;
  addressNeeded?: boolean;
};
type Warranty = {
  demoSessionId?: string;
  unitId: string;
  productName: string;
  imageUrl: string | null;
  serialNumber: string;
  claim: CustomerClaim | null;
};

function ClaimList({ title, description, warranties, sessionId }: { title: string; description: string; warranties: Warranty[]; sessionId: string }) {
  if (!warranties.length) return null;
  return <section className="support-section" aria-label={title}>
    <div className="section-head"><div><h2>{title}</h2><p>{description}</p></div><span className="support-count">{warranties.length}</span></div>
    <div className="support-claim-list">{warranties.map(warranty => {
      const claim = warranty.claim!;
      return <article className="support-claim-card" key={claim.id}>
        <div className="support-claim-image">{warranty.imageUrl ? <ProductPhoto src={warranty.imageUrl} alt={warranty.productName}/> : <LifeBuoy size={28}/>}</div>
        <div className="support-claim-copy"><div className="support-claim-topline"><span>{warranty.productName}</span><span>{formatDate(new Date(claim.submittedAt))}</span></div><h3>{claim.issueTitle}</h3><p>Claim {claim.reference} · Serial {warranty.serialNumber}</p>{claim.addressNeeded && <strong style={{ color: "#9a521d", fontSize: 13 }}>Your address is needed</strong>}</div>
        <div className="support-claim-end"><ClaimStatusBadge status={claim.status}/><Link className="action secondary" to={`/demo/${warranty.demoSessionId || sessionId}/customer/claims/${claim.id}`}>{claim.addressNeeded ? "Add address" : "View claim"} <ArrowRight size={15}/></Link></div>
      </article>;
    })}</div>
  </section>;
}

export default function CustomerSupport() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [warranties, setWarranties] = useState<Warranty[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    apiFetch(sessionId ? `/api/demo/${sessionId}/customer` : "/api/account/customer", { cache: "no-store" }).then(readApiResponse)
      .then(data => { if (active) setWarranties(data.warranties || []); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Could not load your claims."); });
    return () => { active = false; };
  }, [sessionId]);

  const claimed = (warranties || []).filter(warranty => warranty.claim);
  const ongoing = claimed.filter(warranty => !["RESOLVED", "REJECTED"].includes(warranty.claim!.status));
  const closed = claimed.filter(warranty => ["RESOLVED", "REJECTED"].includes(warranty.claim!.status));
  return <main className="page-wrap content support-page">
    <header className="support-header"><div><span className="eyebrow">Vouch support</span><h1>Your claims</h1><p>Follow the progress of claims you’ve submitted for your registered products.</p></div><div className="support-header-icon" aria-hidden="true"><LifeBuoy size={26}/></div></header>
    {error && <div className="notice error" role="alert">{error}</div>}
    {!warranties && !error && <p className="support-loading" role="status">Loading your claims…</p>}
    {warranties && !claimed.length && <section className="support-empty"><LifeBuoy size={28} aria-hidden="true"/><h2>No claims yet</h2><p>If a registered product needs help, open its warranty and raise a claim. You’ll be able to track it here.</p><Link className="action" to="/customer">View my warranties <ArrowRight size={16}/></Link></section>}
    <ClaimList title="In progress" description="Submitted, under review, or waiting for a decision." warranties={ongoing} sessionId={sessionId || ""}/>
    <ClaimList title="Claim history" description="Claims with a recorded outcome." warranties={closed} sessionId={sessionId || ""}/>
  </main>;
}
