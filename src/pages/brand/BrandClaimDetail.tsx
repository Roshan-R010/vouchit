import { Select } from "@/components/select";
import { ClaimStatusBadge } from "@/components/claim-status-badge";
import { ClaimEvidence } from "@/components/claim-evidence";
import { ProductPhoto } from "@/components/product-photo";
import { apiFetch } from "@/lib/api-fetch";
import React, { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Clock, ShieldAlert, CheckCircle, HelpCircle, XCircle, ArrowRight, User, Package, Calendar, ChevronDown } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { shortClaimReference } from "@/lib/claim-reference";
import { ClaimResolutionPanel } from "@/components/claim-resolution-panel";
import { ClaimTemplatePicker, type TemplateCategory } from "@/components/claim-template-picker";
import { ClaimCosts, useClaimCosts } from "@/components/claim-costs";
import styles from "./claim-detail.module.css";

const claimStatusLabel: Record<string, string> = {
  SUBMITTED: "New / Needs Review",
  UNDER_REVIEW: "In review",
  INFO_REQUESTED: "Waiting on customer info",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RESOLVED: "Resolved",
};

function claimBadgeStyle(status: string): React.CSSProperties {
  if (status === "SUBMITTED") return { background: "#edf1f9", color: "#4f6798" };
  if (status === "UNDER_REVIEW") return { background: "#fbf2df", color: "#917036" };
  if (status === "RESOLVED" || status === "APPROVED") return { background: "#eaf4e9", color: "#4e8050" };
  if (status === "REJECTED") return { background: "#faece9", color: "#a5655d" };
  return { background: "#f0f2ed", color: "#737d69" };
}

type DetailTab = "details" | "resolution" | "costs" | "activity";
const detailTabs: { id: DetailTab; label: string }[] = [
  { id: "details", label: "Claim Details" }, { id: "resolution", label: "Resolution" },
  { id: "costs", label: "Resolution Costs" }, { id: "activity", label: "Activity" },
];

export function BrandClaimDetail() {
  const { sessionId, claimId } = useParams<{ sessionId: string; claimId: string }>();
  const [searchParams] = useSearchParams();
  const [claim, setClaim] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("details");
  const costEditor = useClaimCosts(sessionId || "", claimId || "");
  const decisionInitializedFor = useRef<string | null>(null);

  // Form states for actions
  const [decision, setDecision] = useState<string>("approve");
  const [note, setNote] = useState<string>("");
  const [requestingAddress, setRequestingAddress] = useState(false);

  const loadClaim = () => {
    if (!sessionId || !claimId) return;
    setLoading(true);
    apiFetch(`/api/demo/${sessionId}/brand/claims/${claimId}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.claim) {
          setClaim(data.claim);
          if (decisionInitializedFor.current !== claimId) {
            setDecision(data.claim.status === "SUBMITTED" ? "review" : data.claim.status === "UNDER_REVIEW" && ["approve", "request_info", "reject"].includes(searchParams.get("decision") || "") ? searchParams.get("decision")! : "approve");
            decisionInitializedFor.current = claimId!;
          } else if (data.claim.status === "UNDER_REVIEW") {
            setDecision(current => current === "review" ? "approve" : current);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load claim detail:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadClaim();
  }, [sessionId, claimId]);

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !claimId) return;
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const response = await apiFetch(`/api/demo/${sessionId}/brand/claims/${claimId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          note,
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Action could not be completed.");
      }

      setSuccess(resData.message || "Claim updated successfully");
      setNote("");
      loadClaim();
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const requestAddress = async () => {
    if (!sessionId || !claimId || requestingAddress) return;
    setRequestingAddress(true); setError(null); setSuccess(null);
    try {
      const response = await apiFetch(`/api/demo/${sessionId}/brand/claims/${claimId}/request-address`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolutionMethod: claim.resolution?.type }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not request the address.");
      setSuccess("Address requested from the customer.");
      loadClaim();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not request the address."); }
    finally { setRequestingAddress(false); }
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#777" }}>
        <div
          style={{
            width: "30px",
            height: "30px",
            border: "3px solid #e2e6de",
            borderTopColor: "#4a5442",
            borderRadius: "50%",
            animation: "business-spin 0.8s linear infinite",
            margin: "0 auto 12px",
          }}
        />
        Loading claim details...
      </div>
    );
  }

  if (!claim) {
    return (
      <div>
        <Link to={`/demo/${sessionId}/brand/claims`} className="business-back">
          <ArrowLeft size={14} /> Back to claims
        </Link>
        <div className="business-notice error">Claim could not be found.</div>
      </div>
    );
  }

  const { unit, customer } = claim.registration;
  const status = claim.status;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <Link to={`/demo/${sessionId}/brand/claims`} className={styles.back}><ArrowLeft size={16} /> Back to claims</Link>
          <div className={styles.reference}><span title={claim.reference} aria-label={`Claim ${claim.reference}`}>Claim {shortClaimReference(claim.reference)}</span><ClaimStatusBadge status={status}/></div>
        </div>
        <div className={styles.titleRow}><h1>{claim.issueTitle}</h1><p>Submitted by {customer.name} on {formatDate(claim.submittedAt)}</p></div>
      </header>

      {success && <div className="business-notice">{success}</div>}
      {error && <div className="business-notice error">{error}</div>}
      {claim.requiresReturnReview && <div className="business-notice">This unit was returned while the claim was open. Review the claim and its warranty history before taking further action.</div>}

      <div className={styles.tabBar} role="tablist" aria-label="Claim sections" onKeyDown={event => {
        const current = detailTabs.findIndex(tab => tab.id === activeTab);
        const next = event.key === "ArrowRight" ? (current + 1) % detailTabs.length : event.key === "ArrowLeft" ? (current + detailTabs.length - 1) % detailTabs.length : event.key === "Home" ? 0 : event.key === "End" ? detailTabs.length - 1 : -1;
        if (next < 0) return;
        event.preventDefault(); setActiveTab(detailTabs[next].id);
        document.getElementById(`claim-tab-${detailTabs[next].id}`)?.focus();
      }}>
        {detailTabs.map(tab => <button key={tab.id} id={`claim-tab-${tab.id}`} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`claim-panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1} className={styles.tab} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
      </div>

      {activeTab === "details" && <section id="claim-panel-details" role="tabpanel" aria-labelledby="claim-tab-details"><div className={styles.columns}>
        {/* Left Column: Details, Unit, Events */}
        <div className={styles.column}>
          {/* Issue Statement */}
          <div className="business-panel">
            <div className="business-panel-header">
              <h2>Customer Statement</h2>
            </div>
            <div className={styles.panelBody}>
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{claim.description}</p>
              {claim.issueTags?.length > 0 && <div className={styles.reportedIssues}><strong>Reported issues</strong><div className="issue-tag-list">{claim.issueTags.map((tag: string) => <span className="issue-tag" key={tag}>{tag}</span>)}</div></div>}
              <div className={styles.evidence}><strong>Customer photos</strong><ClaimEvidence sessionId={sessionId!} claimId={claimId!} attachments={claim.attachments || []} /></div>
            </div>
          </div>

          {/* Unit & Purchase Order Link */}
          <div className="business-panel">
            <div className="business-panel-header">
              <h2>Product & Delivery Record</h2>
            </div>
            <div className={styles.productRecord} data-has-image={!!unit.productModel.imageUrl}>
              {unit.productModel.imageUrl && <div className={styles.productImage}><ProductPhoto src={unit.productModel.imageUrl} alt={unit.productModel.name}/></div>}
              <dl className={styles.productFacts}>
                <div><dt>Model</dt><dd><strong>{unit.productModel.name}</strong><span>SKU: {unit.productModel.sku || "N/A"}</span></dd></div>
                <div><dt>Stamped unit ID</dt><dd>{unit.serialNumber}</dd></div>
                <div><dt>Purchase order</dt><dd>{unit.purchaseOrder?.orderNumber || "N/A"}<span>Delivered: {unit.purchaseOrder?.deliveredOn ? formatDate(unit.purchaseOrder.deliveredOn) : "N/A"}</span></dd></div>
                <div><dt>Warranty</dt><dd>{unit.productModel.warrantyMonths} months<span>Through: {formatDate(claim.registration.coverageEndsOn)}</span></dd></div>
              </dl>
            </div>
          </div>

        </div>

        {/* Right Column: Actions */}
        <div className={styles.column}>
          <div className="business-panel">
            <div className="business-panel-header">
              <h2>Review & decision</h2>
            </div>

            <div className={styles.panelBody}>
              {status === "RESOLVED" && (
                <div style={{ textAlign: "center", padding: "16px 0", color: "#4e8050" }}>

                  <h3 style={{ fontSize: "15px", margin: "0 0 6px" }}>Claim resolved</h3>
                  <p style={{ fontSize: "14px", color: "#6a7b68", margin: 0 }}>
                    Resolution: {claim.resolution?.type ? claim.resolution.type.toLowerCase() : "Completed"}.
                  </p>
                </div>
              )}

              {status === "REJECTED" && (
                <div style={{ textAlign: "center", padding: "16px 0", color: "#a5655d" }}>

                  <h3 style={{ fontSize: "15px", margin: "0 0 6px" }}>Claim rejected</h3>
                  <p style={{ fontSize: "14px", color: "#8a6660", margin: 0 }}>The decision and reason are recorded in the claim history.</p>
                </div>
              )}

              {status === "INFO_REQUESTED" && (
                <div style={{ textAlign: "center", padding: "16px 0", color: "#917036" }}>

                  <h3 style={{ fontSize: "15px", margin: "0 0 6px" }}>Awaiting customer response</h3>
                  <p style={{ fontSize: "14px", color: "#887856", margin: 0 }}>
                    The claim will return to review when the customer replies.
                  </p>
                </div>
              )}

              {/* Review actions remain separate from operational resolution. */}
              {(status === "SUBMITTED" || status === "UNDER_REVIEW") && (
                <form onSubmit={handleActionSubmit}>
                  {status === "SUBMITTED" && (
                    <div>
                      <p style={{ fontSize: "14px", color: "#636d5e", lineHeight: 1.6, marginBottom: "16px" }}>
                        This is a new customer warranty claim. Begin review to evaluate issue details and evidence.
                      </p>
                      <button type="submit" disabled={submitting} className="business-button primary" style={{ width: "100%" }}>
                        {submitting ? "Saving?" : "Start review"}
                      </button>
                    </div>
                  )}

                  {status === "UNDER_REVIEW" && (
                    <div>
                      <div className="business-field">
                        <label>Action</label>
                        <Select
                          value={decision}
                          onChange={(e) => setDecision(e.target.value)}
                          style={{
                            padding: "9px 12px",
                            fontSize: "14px",
                            border: "1px solid #dde3d6",
                            borderRadius: "6px",
                            outline: 0,
                          }}
                        >
                          <option value="approve">Approve claim</option>
                          <option value="request_info">Request information</option>
                          <option value="reject">Reject claim</option>
                        </Select>
                      </div>

                      <div className="business-field">
                        <ClaimTemplatePicker sessionId={sessionId!} category={decision.toUpperCase() as TemplateCategory} value={note} onInsert={setNote} disabled={submitting}/>
                        <label>
                          {decision === "request_info"
                            ? "Question for Customer *"
                            : decision === "reject"
                            ? "Rejection Reason *"
                            : "Approval Note (Optional)"}
                        </label>
                        <textarea
                          placeholder={
                            decision === "request_info"
                              ? "Tell the customer what information is needed to continue."
                              : decision === "reject"
                              ? "Explain why this claim is not covered and reference the relevant warranty terms."
                              : "Add the review findings and next steps for the customer."
                          }
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows={4}
                          maxLength={2000}
                          required={decision === "request_info" || decision === "reject"}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className={`business-button ${decision === "reject" ? "" : "primary"}`}
                        style={{
                          width: "100%",
                          ...(decision === "reject" ? { background: "#faece9", color: "#a5655d", borderColor: "#eed2cd" } : {}),
                        }}
                      >
                        {submitting
                          ? "Saving..."
                          : decision === "approve"
                          ? "Approve claim"
                          : decision === "request_info"
                          ? "Request information"
                          : "Reject claim"}
                      </button>
                    </div>
                  )}

                </form>
              )}
            </div>
          </div>

          {/* Customer Summary Card */}
          <div className="business-panel">
            <div className="business-panel-header">
              <h2>Customer details</h2>
            </div>
            <div className={styles.panelBody}>
              <dl className={styles.contact}><div><dt>Name</dt><dd>{customer.name}</dd></div><div><dt>Email</dt><dd>{customer.email}</dd></div></dl>
            </div>
          </div>
        </div>
      </div></section>}

      {activeTab === "resolution" && <section id="claim-panel-resolution" role="tabpanel" aria-labelledby="claim-tab-resolution" className={styles.singlePanel}>
        {status === "APPROVED" || status === "RESOLVED" ? <>
          <ClaimResolutionPanel key={claim.resolution?.id ?? claim.id} sessionId={sessionId!} claim={claim} onChanged={loadClaim}/>
          <div className="business-panel">
            <div className="business-panel-header"><h2>Delivery / collection address</h2><span className={`business-badge ${claim.addressRequest?.receivedAt ? "success" : ""}`}>{claim.addressRequest?.receivedAt ? "Address received" : claim.addressRequest ? "Address still not received" : "Address not requested"}</span></div>
            <div className={styles.panelBody}>
              {claim.addressRequest?.receivedAt ? <address className={styles.deliveryAddress}><strong>{claim.addressRequest.recipient}</strong><br/>{claim.addressRequest.line1}<br/>{claim.addressRequest.line2 && <>{claim.addressRequest.line2}<br/></>}{claim.addressRequest.city}, {claim.addressRequest.region} {claim.addressRequest.postalCode}<br/>{claim.addressRequest.country}{claim.addressRequest.phone && <><br/>Phone: {claim.addressRequest.phone}</>}</address>
                : claim.addressRequest ? <p>The customer has been asked for an address. It will appear here when submitted.</p>
                : <><p>This claim has no address request.</p>{status === "APPROVED" && ["REPAIR", "REPLACEMENT"].includes(claim.resolution?.type) && claim.resolution?.status === "IN_PROGRESS" && <button type="button" className="business-button primary" disabled={requestingAddress} onClick={requestAddress}>{requestingAddress ? "Requesting…" : "Request customer address"}</button>}</>}
            </div>
          </div>
        </> : <div className="business-panel"><div className={styles.panelBody}>Resolution tracking is available after a claim is approved.</div></div>}
      </section>}

      {activeTab === "costs" && <section id="claim-panel-costs" role="tabpanel" aria-labelledby="claim-tab-costs" className={styles.singlePanel}><ClaimCosts editor={costEditor}/></section>}

      {activeTab === "activity" && <section id="claim-panel-activity" role="tabpanel" aria-labelledby="claim-tab-activity" className={styles.singlePanel}>
        <div className="business-panel"><div className="business-panel-header"><h2>History & Transition Events</h2></div><div className={styles.panelBody}><div className={styles.eventList}>
          {claim.events?.length ? claim.events.map((ev: any, idx: number) => <div key={ev.id || idx} className={styles.event}><span className={styles.eventDot}/><div><div className={styles.eventMeta}><strong>{ev.actor === "CUSTOMER" ? customer.name : "Brand Specialist"}</strong><span>{formatDate(ev.createdAt)}</span></div><p>{ev.note || `Transitioned to ${ev.toStatus}`}</p></div></div>) : <p>No activity recorded yet.</p>}
        </div></div></div>
        {!!claim.messages?.length && <div className="business-panel"><div className="business-panel-header"><h2>Conversation</h2></div><div className={styles.panelBody}><div className={styles.eventList}>{claim.messages.map((message: any) => <div key={message.id} className={styles.message}><div className={styles.eventMeta}><strong>{message.author === "CUSTOMER" ? customer.name : "Brand team"}</strong><span>{formatDate(message.createdAt)}</span></div><p>{message.body}</p></div>)}</div></div></div>}
      </section>}
    </div>
  );
}
export default BrandClaimDetail;
