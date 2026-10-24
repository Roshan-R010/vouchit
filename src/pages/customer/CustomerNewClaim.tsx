import { apiFetch } from "@/lib/api-fetch";
import React, { useEffect, useRef, useState } from "react";
import { readApiResponse } from "@/lib/api-response";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle } from "lucide-react";

export function CustomerNewClaim() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const unitId = searchParams.get("unitId") || "";

  const [issueTitle, setIssueTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionId] = useState(() => crypto.randomUUID());
  const submittingRef = useRef(false);
  const [checking, setChecking] = useState(true);
  const [canSubmit, setCanSubmit] = useState(false);
  useEffect(() => {
    let active = true;
    if (!unitId) { setError("Choose a registered product from your dashboard to start a claim."); setChecking(false); return; }
    apiFetch(`/api/demo/${sessionId}/customer/products/${unitId}`).then(readApiResponse).then(data => {
      if (!active) return;
      if (data.registration.claim) navigate(`/demo/${sessionId}/customer/claims/${data.registration.claim.id}`, { replace: true });
      else { setCanSubmit(true); setChecking(false); }
    }).catch(cause => { if (active) { setError(cause.message); setChecking(false); } });
    return () => { active = false; };
  }, [sessionId, unitId, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !unitId || submittingRef.current || checking || !canSubmit) return;
    submittingRef.current = true;
    setError(null);
    setSubmitting(true);

    try {
      const response = await apiFetch(`/api/demo/${sessionId}/customer/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, issueTitle, description, submissionId }),
      });

      const data = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit warranty claim");
      }

      navigate(`/demo/${sessionId}/customer/claims/${data.claimId}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <main className="page-wrap form-shell" style={{ margin: "30px auto" }}>
      <div className="form-header">
        <Link to={`/demo/${sessionId}/customer`} className="reset-link" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <h1>Submit a warranty claim</h1>
        <p>Describe the issue so your brand can review it. Each registered product can have one claim.</p>
      </div>

      <div className="form-body">
        {error && <div className="notice error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="claim-summary">Issue summary</label>
            <input
              type="text"
              id="claim-summary"
              maxLength={120}
              placeholder="Briefly describe the problem"
              value={issueTitle}
              onChange={(e) => setIssueTitle(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="claim-description">What happened?</label>
            <textarea
              id="claim-description"
              maxLength={3000}
              placeholder="Describe when the issue started, steps you've taken to troubleshoot, and current behavior..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              required
            />
          </div>

          <button type="submit" disabled={submitting || checking || !canSubmit || !unitId} className="action" style={{ width: "100%", justifyContent: "center" }}>
            {checking ? "Checking warranty…" : submitting ? "Submitting…" : "Submit claim"}
          </button>
        </form>
      </div>
    </main>
  );
}
export default CustomerNewClaim;
