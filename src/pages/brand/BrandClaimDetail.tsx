import { ClaimStatusBadge } from "@/components/claim-status-badge";
import { apiFetch } from "@/lib/api-fetch";
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Clock, ShieldAlert, CheckCircle, HelpCircle, XCircle, ArrowRight, User, Package, Calendar } from "lucide-react";
import { formatDate } from "@/lib/dates";

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
  const [claim, setClaim] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states for actions
  const [decision, setDecision] = useState<string>("approve");
  const [note, setNote] = useState<string>("");
  const [resolutionMethod, setResolutionMethod] = useState<string>("REPAIR");

  const loadClaim = () => {
    if (!sessionId || !claimId) return;
    setLoading(true);
    apiFetch(`/api/demo/${sessionId}/brand/claims/${claimId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.claim) {
          setClaim(data.claim);
          // Set default decision based on status
          if (data.claim.status === "SUBMITTED") setDecision("review");
          else if (data.claim.status === "UNDER_REVIEW") setDecision("approve");
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
          resolutionMethod: decision === "resolve" ? resolutionMethod : undefined,
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
    <div>
      <Link to={`/demo/${sessionId}/brand/claims`} className="business-back">
        <ArrowLeft size={14} /> Back to claims inbox
      </Link>

      <div className="business-page-header" style={{ marginBottom: "20px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span className="business-eyebrow" style={{ margin: 0 }}>
              CLAIM {claim.reference}
            </span>
            <ClaimStatusBadge status={status}/>
          </div>
          <h1>{claim.issueTitle}</h1>
          <p>
            Submitted by {customer.name} on {formatDate(claim.submittedAt)}
          </p>
        </div>
      </div>

      {success && <div className="business-notice">{success}</div>}
      {error && <div className="business-notice error">{error}</div>}

      <div className="business-two-columns">
        {/* Left Column: Details, Unit, Events */}
        <div>
          {/* Issue Statement */}
          <div className="business-panel">
            <div className="business-panel-header">
              <h2>Customer Statement</h2>
            </div>
            <div style={{ padding: "20px 22px", fontSize: "15px", lineHeight: "1.7", color: "#373e35" }}>
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{claim.description}</p>
            </div>
          </div>

          {/* Unit & Purchase Order Link */}
          <div className="business-panel">
            <div className="business-panel-header">
              <h2>Product & Delivery Record</h2>
            </div>
            <div style={{ padding: "18px 22px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "14px" }}>
                <div>
                  <div style={{ color: "#596258", fontSize: "14px", fontWeight: 700, textTransform: "uppercase" }}>Model</div>
                  <strong style={{ fontSize: "15px", color: "#242a25" }}>{unit.productModel.name}</strong>
                  <div style={{ color: "#7a8276", marginTop: "2px" }}>SKU: {unit.productModel.sku || "N/A"}</div>
                </div>

                <div>
                  <div style={{ color: "#596258", fontSize: "14px", fontWeight: 700, textTransform: "uppercase" }}>Stamped Unit ID</div>
                  <strong className="business-mono" style={{ fontSize: "15px", color: "#242a25" }}>
                    {unit.serialNumber}
                  </strong>
                </div>

                <div>
                  <div style={{ color: "#596258", fontSize: "14px", fontWeight: 700, textTransform: "uppercase" }}>Purchase Order</div>
                  <div className="business-mono" style={{ fontSize: "14px", color: "#242a25", fontWeight: 600 }}>
                    {unit.purchaseOrder.orderNumber}
                  </div>
                  <div style={{ color: "#7a8276", fontSize: "14px" }}>
                    Delivered: {unit.purchaseOrder.deliveredOn ? formatDate(unit.purchaseOrder.deliveredOn) : "N/A"}
                  </div>
                </div>

                <div>
                  <div style={{ color: "#596258", fontSize: "14px", fontWeight: 700, textTransform: "uppercase" }}>Warranty Duration</div>
                  <div style={{ fontSize: "14px", color: "#242a25", fontWeight: 600 }}>{unit.productModel.warrantyMonths} Months Coverage</div>
                  <div style={{ color: "#7a8276", fontSize: "14px" }}>Through: {formatDate(claim.registration.coverageEndsOn)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Activity / Event Timeline */}
          <div className="business-panel">
            <div className="business-panel-header">
              <h2>History & Transition Events</h2>
            </div>
            <div style={{ padding: "20px 22px" }}>
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
          </div>
        </div>

        {/* Right Column: Actions */}
        <div>
          <div className="business-panel">
            <div className="business-panel-header">
              <h2>Review & decision</h2>
              <ClaimStatusBadge status={status}/>
            </div>

            <div style={{ padding: "20px 22px" }}>
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
                        <select
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
                        </select>
                      </div>

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
                      <p style={{ fontSize: "14px", color: "#636d5e", lineHeight: 1.6, marginBottom: "14px" }}>
                        This claim is approved. Specify how the warranty obligation is fulfilled.
                      </p>

                      <div className="business-field">
                        <label>Resolution Method *</label>
                        <select
                          value={resolutionMethod}
                          onChange={(e) => setResolutionMethod(e.target.value)}
                          style={{
                            padding: "9px 12px",
                            fontSize: "14px",
                            border: "1px solid #dde3d6",
                            borderRadius: "6px",
                            outline: 0,
                          }}
                        >
                          <option value="REPAIR">Repair</option>
                          <option value="REPLACEMENT">Replacement</option>
                        </select>
                      </div>

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

                      <button type="submit" disabled={submitting} className="business-button primary" style={{ width: "100%" }}>
                        {submitting ? "Resolving..." : "Mark as Resolved"}
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
              <h2>Customer Contact</h2>
            </div>
            <div style={{ padding: "18px 22px", fontSize: "14px" }}>
              <div style={{ marginBottom: "10px" }}>
                <div style={{ color: "#596258", fontSize: "14px", fontWeight: 700 }}>NAME</div>
                <strong style={{ color: "#242a25" }}>{customer.name}</strong>
              </div>
              <div>
                <div style={{ color: "#596258", fontSize: "14px", fontWeight: 700 }}>EMAIL</div>
                <div style={{ color: "#555e50" }}>{customer.email}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default BrandClaimDetail;
