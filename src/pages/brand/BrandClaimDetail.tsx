import { Select } from "@/components/select";
import { ClaimStatusBadge } from "@/components/claim-status-badge";
import { ClaimEvidence } from "@/components/claim-evidence";
import { ProductPhoto } from "@/components/product-photo";
import { apiFetch } from "@/lib/api-fetch";
import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Clock, ShieldAlert, CheckCircle, HelpCircle, XCircle, ArrowRight, User, Package, Calendar, ChevronDown } from "lucide-react";
import { formatDate } from "@/lib/dates";
import { shortClaimReference } from "@/lib/claim-reference";
import historyStyles from "./claim-history.module.css";
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

export function BrandClaimDetail() {
  const { sessionId, claimId } = useParams<{ sessionId: string; claimId: string }>();
  const [searchParams] = useSearchParams();
  const [claim, setClaim] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states for actions
  const [decision, setDecision] = useState<string>("approve");
  const [note, setNote] = useState<string>("");
  const [resolutionMethod, setResolutionMethod] = useState<string>("REPAIR");
  const [requestingAddress, setRequestingAddress] = useState(false);

  const loadClaim = () => {
    if (!sessionId || !claimId) return;
    setLoading(true);
    apiFetch(`/api/demo/${sessionId}/brand/claims/${claimId}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.claim) {
          setClaim(data.claim);
          setResolutionMethod(data.claim.resolutionMethod || "REPAIR");
          // Set default decision based on status
          if (data.claim.status === "SUBMITTED") setDecision("review");
          else if (data.claim.status === "UNDER_REVIEW") setDecision(["approve", "request_info", "reject"].includes(searchParams.get("decision") || "") ? searchParams.get("decision")! : "approve");
          else if (data.claim.status === "APPROVED") setDecision("resolve");
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
          resolutionMethod: decision === "resolve" || decision === "approve" ? resolutionMethod : undefined,
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
      const response = await apiFetch(`/api/demo/${sessionId}/brand/claims/${claimId}/request-address`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolutionMethod }) });
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

      <div className={styles.columns}>
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
                <div><dt>Purchase order</dt><dd>{unit.purchaseOrder.orderNumber}<span>Delivered: {unit.purchaseOrder.deliveredOn ? formatDate(unit.purchaseOrder.deliveredOn) : "N/A"}</span></dd></div>
                <div><dt>Warranty</dt><dd>{unit.productModel.warrantyMonths} months<span>Through: {formatDate(claim.registration.coverageEndsOn)}</span></dd></div>
              </dl>
            </div>
          </div>

          {/* Activity / Event Timeline */}
          <details key={claim.id} className={`business-panel ${historyStyles.panel}`}>
            <summary className={`business-panel-header ${historyStyles.toggle}`}>
              <h2>History & Transition Events</h2>
              <ChevronDown size={20} aria-hidden="true" />
            </summary>
            <div className={styles.panelBody}>
              <div style={{ display: "grid", gap: "16px" }}>
                {claim.events?.map((ev: any, idx: number) => (
                  <div key={ev.id || idx} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "#536148",
                        marginTop: "6px",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                        <strong>{ev.actor === "CUSTOMER" ? customer.name : "Brand Specialist"}</strong>
                        <span style={{ color: "#9aa196" }}>{formatDate(ev.createdAt)}</span>
                      </div>
                      <div style={{ fontSize: "14px", color: "#4f574c", marginTop: "3px" }}>
                        {ev.note || `Transitioned to ${ev.toStatus}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>
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
                    Resolution: {claim.resolutionMethod === "REPAIR" ? "Repair" : claim.resolutionMethod === "REPLACEMENT" ? "Replacement" : "Not recorded"}.
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

              {/* Action Form if SUBMITTED, UNDER_REVIEW, or APPROVED */}
              {(status === "SUBMITTED" || status === "UNDER_REVIEW" || status === "APPROVED") && (
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

                      {decision === "approve" && <div className="business-field"><label>Planned resolution</label><Select value={resolutionMethod} onChange={event => setResolutionMethod(event.target.value)} required><option value="REPAIR">Repair</option><option value="REPLACEMENT">Replacement</option></Select><p className="business-hint">Approving will ask the customer for a delivery or collection address.</p></div>}

                      <div className="business-field">
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

                  {status === "APPROVED" && (
                    <div>
                      <p className={styles.plan}>
                        <strong>{claim.resolutionMethod === "REPLACEMENT" ? "Replacement" : "Repair"} approved.</strong> {claim.addressRequest?.receivedAt ? "Record the outcome once completed." : "Waiting for the customer’s address."}
                      </p>

                      <div className="business-field">
                        <label>Outcome Details *</label>
                        <textarea
                          placeholder="Describe the repair or replacement and include any relevant delivery details."
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          rows={3}
                          required
                        />
                      </div>

                      <button type="submit" disabled={submitting || !claim.addressRequest?.receivedAt} className="business-button primary" style={{ width: "100%" }}>
                        {submitting ? "Resolving..." : claim.addressRequest?.receivedAt ? "Mark as Resolved" : "Waiting for customer address"}
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
              {(status === "APPROVED" || status === "RESOLVED") && <span className={`business-badge ${claim.addressRequest?.receivedAt ? "success" : ""}`}>{claim.addressRequest?.receivedAt ? "Address received" : claim.addressRequest ? "Address still not received" : "Address not requested"}</span>}
            </div>
            <div className={styles.panelBody}>
              <dl className={styles.contact}><div><dt>Name</dt><dd>{customer.name}</dd></div><div><dt>Email</dt><dd>{customer.email}</dd></div></dl>
              {(status === "APPROVED" || status === "RESOLVED") && <section className={styles.address} aria-label="Customer address">
                <h3>Delivery / collection address</h3>
                {claim.addressRequest?.receivedAt ? <address><strong>{claim.addressRequest.recipient}</strong><br/>{claim.addressRequest.line1}<br/>{claim.addressRequest.line2 && <>{claim.addressRequest.line2}<br/></>}{claim.addressRequest.city}, {claim.addressRequest.region} {claim.addressRequest.postalCode}<br/>{claim.addressRequest.country}{claim.addressRequest.phone && <><br/>Phone: {claim.addressRequest.phone}</>}</address> : claim.addressRequest ? <p>The customer has been asked for an address. It will appear here when submitted.</p> : <><p>This claim has no address request.</p>{status === "APPROVED" && <>{!claim.resolutionMethod && <div className="business-field"><label>Planned resolution</label><Select value={resolutionMethod} onChange={event => setResolutionMethod(event.target.value)}><option value="REPAIR">Repair</option><option value="REPLACEMENT">Replacement</option></Select></div>}<button type="button" className="business-button primary" disabled={requestingAddress} onClick={requestAddress}>{requestingAddress ? "Requesting…" : "Request customer address"}</button></>}</>}
              </section>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default BrandClaimDetail;
