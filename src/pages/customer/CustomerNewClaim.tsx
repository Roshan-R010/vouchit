import React, { useEffect, useState } from "react";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !unitId) return;
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(`/api/demo/${sessionId}/customer/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, issueTitle, description }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit warranty claim");
      }

      navigate(`/demo/${sessionId}/customer/claims/${data.claimId}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page-wrap form-shell" style={{ margin: "30px auto" }}>
      <div className="form-header">
        <Link to={`/demo/${sessionId}/customer`} className="reset-link" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <h1>File a Warranty Claim</h1>
        <p>Submit an issue for review under your active hardware warranty.</p>
      </div>

      <div className="form-body">
        {error && <div className="notice error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Issue Summary *</label>
            <input
              type="text"
              placeholder="e.g. Left earcup audio cut out completely"
              value={issueTitle}
              onChange={(e) => setIssueTitle(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label>Detailed Description of the Issue *</label>
            <textarea
              placeholder="Describe when the issue started, steps you've taken to troubleshoot, and current behavior..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              required
            />
          </div>

          <button type="submit" disabled={submitting} className="action" style={{ width: "100%", justifyContent: "center" }}>
            {submitting ? "Submitting Claim..." : "Submit Claim for Review"}
          </button>
        </form>
      </div>
    </main>
  );
}
export default CustomerNewClaim;
