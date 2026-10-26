import { ClaimStatusBadge } from "@/components/claim-status-badge";
import { apiFetch } from "@/lib/api-fetch";
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/dates";

export function CustomerClaimDetail() {
  const { sessionId, claimId } = useParams<{ sessionId: string; claimId: string }>();
  const [claim, setClaim] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [replyMessage, setReplyMessage] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadClaim = () => {
    if (!sessionId || !claimId) return;
    setLoading(true);
    apiFetch(`/api/demo/${sessionId}/customer/claims/${claimId}`)
      .then((res) => res.json())
      .then((data) => {
        setClaim(data.claim);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load claim:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadClaim();
  }, [sessionId, claimId]);

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !claimId || !replyMessage.trim()) return;
    setSubmittingReply(true);
    setNotice(null);

    try {
      const response = await apiFetch(`/api/demo/${sessionId}/customer/claims/${claimId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyMessage.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit response");
      }

      setNotice("Your response has been sent to the support team.");
      setReplyMessage("");
      loadClaim();
    } catch (err: any) {
      setNotice(err.message || "Failed to submit response.");
    } finally {
      setSubmittingReply(false);
    }
  };

  if (loading) {
    return (
      <main className="page-wrap" style={{ padding: "60px 0", textAlign: "center" }}>
        Loading claim status...
      </main>
    );
  }

  if (!claim) {
    return (
      <main className="page-wrap">
        <div className="notice error">Claim not found.</div>
      </main>
    );
  }

  const { unit, customer } = claim.registration;
  const status = claim.status;

  // Timeline step active states
  const isSubmitted = true;
  const isUnderReview = status !== "SUBMITTED";
  const isDecided = status === "APPROVED" || status === "RESOLVED" || status === "REJECTED";
  const isComplete = status === "RESOLVED" || status === "REJECTED";

  return (
    <main className="page-wrap form-shell" style={{ margin: "30px auto" }}>
      <div className="tracking-head">
        <div>
          <Link to="/customer" className="reset-link" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
            <ArrowLeft size={14} /> Back to dashboard
          </Link>
          <h1>{claim.issueTitle}</h1>
          <p>
            Reference: {claim.reference} · {unit.productModel.name}
          </p>
        </div>
        <div>
          <ClaimStatusBadge status={status}/>
        </div>
      </div>

      {/* 4-Step Visual Timeline */}
      <div className="timeline">
        <div className={`timeline-step ${isSubmitted ? "complete" : ""}`}>
          <div className="timeline-marker" />
          <span>Submitted</span>
        </div>
        <div className={`timeline-step ${isUnderReview ? "complete" : ""} ${status === "UNDER_REVIEW" || status === "INFO_REQUESTED" ? "current" : ""}`}>
          <div className="timeline-marker" />
          <span>Under Review</span>
        </div>
        <div className={`timeline-step ${isDecided ? "complete" : ""} ${status === "APPROVED" ? "current" : ""}`}>
          <div className="timeline-marker" />
          <span>Decision</span>
        </div>
        <div className={`timeline-step ${isComplete ? "complete" : ""}`}>
          <div className="timeline-marker" />
          <span>{status === "REJECTED" ? "Closed" : "Resolved"}</span>
        </div>
      </div>

      {notice && <div className="notice" style={{ margin: "0 30px 20px" }}>{notice}</div>}

      {/* Information Request from Brand */}
      {status === "INFO_REQUESTED" && (
        <div style={{ margin: "0 30px 24px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "10px", padding: "18px" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: "14px", color: "#9a3412" }}>Additional Information Needed</h3>
          <p style={{ margin: "0 0 14px", fontSize: "15px", color: "#7c2d12" }}>
            The brand specialist asked for more details to continue evaluating this warranty claim:
          </p>

          {claim.messages?.length > 0 && (
            <div style={{ background: "#fff", padding: "12px 14px", borderRadius: "6px", marginBottom: "14px", fontSize: "15px", color: "#333", border: "1px solid #ffedd5" }}>
              "{claim.messages[claim.messages.length - 1].body}"
            </div>
          )}

          <form onSubmit={handleReplySubmit}>
            <textarea
              placeholder="Type your response here..."
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              rows={3}
              required
              style={{ width: "100%", padding: "10px", border: "1px solid #fed7aa", borderRadius: "6px", fontSize: "15px" }}
            />
            <button type="submit" disabled={submittingReply} className="action" style={{ marginTop: "10px" }}>
              {submittingReply ? "Sending..." : "Submit Response"}
            </button>
          </form>
        </div>
      )}

      {/* Claim Summary & History */}
      <div className="claim-info">
        <h3>Claim Particulars</h3>
        {claim.issueTags?.length > 0 && <div className="claim-selected-tags"><h3>Reported issues</h3><div className="issue-tag-list">{claim.issueTags.map((tag: string) => <span className="issue-tag" key={tag}>{tag}</span>)}</div></div>}
        <div className="info-row">
          <span>Product</span>
          <span>{unit.productModel.name}</span>
        </div>
        <div className="info-row">
          <span>Stamped Unit ID</span>
          <span>{unit.serialNumber}</span>
        </div>
        <div className="info-row">
          <span>Order Reference</span>
          <span>{unit.purchaseOrder.orderNumber}</span>
        </div>
        <div className="info-row">
          <span>Original Description</span>
          <span>{claim.description}</span>
        </div>
      </div>

      {/* Activity Log */}
      <div style={{ padding: "0 30px 30px" }}>
        <h3 style={{ fontSize: "15px", marginBottom: "14px" }}>Claim Timeline & Event Log</h3>
        <div style={{ display: "grid", gap: "12px" }}>
          {claim.events?.map((ev: any, idx: number) => (
            <div key={ev.id || idx} className="message" style={{ margin: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                <strong>{ev.actor === "BRAND" ? "Brand Support" : customer.name}</strong>
                <span style={{ fontSize: "14px", color: "#888" }}>{formatDate(ev.createdAt)}</span>
              </div>
              <div style={{ fontSize: "14px" }}>{ev.note || `Status changed to ${ev.toStatus}`}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
export default CustomerClaimDetail;
