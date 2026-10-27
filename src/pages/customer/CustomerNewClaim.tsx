import { apiFetch } from "@/lib/api-fetch";
import React, { useEffect, useRef, useState } from "react";
import { readApiResponse } from "@/lib/api-response";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ImagePlus, X } from "lucide-react";
import { prepareClaimPhoto, type PreparedClaimPhoto } from "@/lib/claim-photo";
import styles from "./claim-photo-picker.module.css";

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
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [issueTags, setIssueTags] = useState<string[]>([]);
  const [photoLimit, setPhotoLimit] = useState(0);
  const [photos, setPhotos] = useState<PreparedClaimPhoto[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoBusyRef = useRef(false);
  useEffect(() => {
    let active = true;
    setChecking(true); setCanSubmit(false); setAvailableTags([]); setIssueTags([]); setPhotoLimit(0); setPhotos([]);
    if (!unitId) { setError("Choose a registered product from your dashboard to start a claim."); setChecking(false); return; }
    apiFetch(`/api/demo/${sessionId}/customer/products/${unitId}`).then(readApiResponse).then(data => {
      if (!active) return;
      if (data.registration.claim) navigate(`/demo/${sessionId}/customer/claims/${data.registration.claim.id}`, { replace: true });
      else { setAvailableTags(data.registration.unit.productModel.issueTags || []); setPhotoLimit(data.registration.unit.productModel.claimPhotoLimit ?? 3); setCanSubmit(true); setChecking(false); }
    }).catch(cause => { if (active) { setError(cause.message); setChecking(false); } });
    return () => { active = false; };
  }, [sessionId, unitId, navigate]);

  const handlePhotos = async (files: FileList | null) => {
    if (!files?.length || photoBusyRef.current) return;
    const incoming = Array.from(files);
    if (photos.length + incoming.length > photoLimit) {
      setPhotoError(`You can attach up to ${photoLimit} ${photoLimit === 1 ? "photo" : "photos"} for this product.`);
      return;
    }
    photoBusyRef.current = true;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const prepared: PreparedClaimPhoto[] = [];
      for (const file of incoming) prepared.push(await prepareClaimPhoto(file));
      setPhotos(current => [...current, ...prepared].slice(0, photoLimit));
    } catch (cause) {
      setPhotoError(cause instanceof Error ? cause.message : "Could not prepare the photos.");
    } finally {
      photoBusyRef.current = false;
      setPhotoBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !unitId || submittingRef.current || checking || !canSubmit || photoBusyRef.current) return;
    submittingRef.current = true;
    setError(null);
    setSubmitting(true);

    try {
      const response = await apiFetch(`/api/demo/${sessionId}/customer/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, issueTitle, description, submissionId, issueTags, photoDataUrls: photos.map(photo => photo.dataUrl) }),
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
        <Link to="/customer" className="reset-link" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 12 }}>
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <h1>Submit a warranty claim</h1>
        <p>Describe the issue so your brand can review it. Each registered product can have one claim.</p>
      </div>

      <div className="form-body">
        {error && <div className="notice error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {availableTags.length > 0 && <fieldset className="claim-issue-tags" disabled={submitting || checking}>
            <legend>Which issues match your problem?</legend>
            <p>Select all that apply. If none match, describe the issue below.</p>
            <div className="issue-tag-list">{availableTags.map(tag => <label className={`issue-tag-option ${issueTags.includes(tag) ? "selected" : ""}`} key={tag}>
              <input type="checkbox" checked={issueTags.includes(tag)} onChange={event => setIssueTags(current => event.target.checked ? [...current, tag] : current.filter(item => item !== tag))}/><span>{tag}</span>
            </label>)}</div>
          </fieldset>}
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

          {photoLimit > 0 && <div className={styles.section}>
            <div className={styles.heading}><strong>Photos of the issue</strong><span>{photos.length}/{photoLimit}</span></div>
            <p className={styles.hint}>Optional. Add up to {photoLimit} JPG, PNG, or WebP {photoLimit === 1 ? "photo" : "photos"}. We resize them automatically before upload.</p>
            {photos.length < photoLimit && <label className={styles.picker} aria-disabled={photoBusy || submitting}>
              <ImagePlus size={17}/> Add photos
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={photoBusy || submitting} onChange={event => { void handlePhotos(event.target.files); event.target.value = ""; }}/>
            </label>}
            {photoBusy && <p className={styles.processing}>Preparing photos…</p>}
            {photoError && <p className="notice error" role="alert">{photoError}</p>}
            {photos.length > 0 && <div className={styles.previews}>{photos.map((photo, index) => <div className={styles.preview} key={`${photo.name}-${index}`}><img src={photo.dataUrl} alt={`Attachment ${index + 1}`} /><button type="button" aria-label={`Remove photo ${index + 1}`} disabled={photoBusy || submitting} onClick={() => setPhotos(current => current.filter((_, position) => position !== index))}><X size={15}/></button></div>)}</div>}
          </div>}

          <button type="submit" disabled={submitting || checking || photoBusy || !canSubmit || !unitId} className="action" style={{ width: "100%", justifyContent: "center" }}>
            {checking ? "Checking warranty…" : submitting ? "Submitting…" : "Submit claim"}
          </button>
        </form>
      </div>
    </main>
  );
}
export default CustomerNewClaim;
