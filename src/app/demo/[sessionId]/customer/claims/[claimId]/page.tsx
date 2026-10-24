import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { CustomerNav } from "@/components/customer-nav";
import { replyToInfoRequestAction } from "@/app/actions";
import { db } from "@/lib/db";
import { daysRemaining, formatDate } from "@/lib/dates";
import { ClaimStatus } from "@prisma/client";

type Props={params:Promise<{sessionId:string;claimId:string}>};
const stateLabel:Record<ClaimStatus,string>={SUBMITTED:"Submitted",UNDER_REVIEW:"In review",INFO_REQUESTED:"More information needed",APPROVED:"Approved",REJECTED:"Rejected",RESOLVED:"Resolved"};
export default async function ClaimTrackingPage({params}:Props){
  const {sessionId,claimId}=await params;
  const claim=await db.warrantyClaim.findFirst({where:{id:claimId,registration:{customer:{demoSessionId:sessionId}}},include:{registration:{include:{unit:{include:{productModel:true,purchaseOrder:true,brand:true}}}},attachments:{orderBy:{createdAt:"asc"}},events:{orderBy:{createdAt:"asc"}},messages:{orderBy:{createdAt:"asc"}}}});
  if(!claim)return <><CustomerNav sessionId={sessionId}/><main className="page-wrap content"><div className="blank-state" style={{marginTop:50}}>We couldn’t find this claim. <Link href={`/demo/${sessionId}/customer`}>Back to products →</Link></div></main></>;
  const latestBrandMessage=[...claim.messages].reverse().find((message)=>message.author==="BRAND");
  const journey:ClaimStatus[]=[ClaimStatus.SUBMITTED,ClaimStatus.UNDER_REVIEW,ClaimStatus.APPROVED,ClaimStatus.RESOLVED];
  let activeIndex=claim.status===ClaimStatus.INFO_REQUESTED?1:claim.status===ClaimStatus.REJECTED?3:journey.indexOf(claim.status);if(activeIndex<0)activeIndex=0;
  const steps=claim.status===ClaimStatus.REJECTED?["Submitted","In review","Decision","Closed"]:["Submitted","In review","Resolution","Completed"];
  const remaining=daysRemaining(claim.registration.coverageEndsOn);
  return <><CustomerNav sessionId={sessionId}/><main className="page-wrap content"><div className="form-shell"><header className="tracking-head"><div><Link href={`/demo/${sessionId}/customer`} className="muted" style={{fontSize:11}}><ArrowLeft size={12} style={{verticalAlign:"middle"}}/> My products</Link><div className="eyebrow" style={{marginTop:14}}>Claim tracking</div><h1>Claim {claim.reference}</h1><p>Submitted {formatDate(claim.submittedAt)}</p></div><span className={`status-pill ${claim.status.toLowerCase()}`} style={{alignSelf:"center"}}>{stateLabel[claim.status]}</span></header>
    <div className="timeline">{steps.map((step,i)=><div key={step} className={`timeline-step ${i<activeIndex?"complete":""} ${i===activeIndex?"current":""}`}><div className="timeline-marker"/>{step}</div>)}</div>
    <div className="claim-info"><h3>Claim details</h3><div className="info-row"><span>Product</span><span>{claim.registration.unit.productModel.name}</span></div><div className="info-row"><span>Unit ID</span><span>{claim.registration.unit.serialNumber}</span></div><div className="info-row"><span>Issue</span><span>{claim.issueTitle}</span></div><div className="info-row"><span>Warranty</span><span>{remaining} days remaining · ends {formatDate(claim.registration.coverageEndsOn)}</span></div><div className="info-row"><span>Submitted on</span><span>{formatDate(claim.submittedAt)}</span></div><div className="message">{claim.description}</div>
      {claim.attachments.length > 0 && <div className="claim-photos">{claim.attachments.map((photo, i) => <a key={photo.id} href={photo.fileKey} target="_blank" rel="noreferrer"><img src={photo.fileKey} alt={`Claim photo ${i + 1}`}/></a>)}</div>}
      {claim.events.map((event)=><div className="message" key={event.id}><strong>{stateLabel[event.toStatus]}</strong> · {event.note||"Claim updated"}<div className="muted" style={{fontSize:10,marginTop:5}}>{formatDate(event.createdAt)}</div></div>)}
      {latestBrandMessage&&<div className="message"><strong>Message from {claim.registration.unit.brand.name}</strong><p style={{margin:"6px 0 0"}}>{latestBrandMessage.body}</p></div>}
    </div>
    {claim.status===ClaimStatus.INFO_REQUESTED&&<form className="form-body" action={replyToInfoRequestAction} style={{paddingTop:0}}><input type="hidden" name="sessionId" value={sessionId}/><input type="hidden" name="claimId" value={claim.id}/><div className="field"><label htmlFor="reply">Reply to the brand</label><textarea id="reply" name="reply" placeholder="Add the information they asked for…" required maxLength={2000}/></div><button className="action" type="submit">Send reply <Check size={14}/></button></form>}
    {claim.status===ClaimStatus.SUBMITTED&&<p className="footer-note">Your claim is submitted. The brand will review it here; refresh this page for updates.</p>}
    </div></main></>;
}
