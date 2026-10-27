import { useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";

export function ClaimPhotoLimitField({ value, onChange, disabled = false }: { value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return <div className="business-field">
    <label>Customer claim photos</label>
    <label style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 600 }}><input type="checkbox" checked={value > 0} disabled={disabled} onChange={event => onChange(event.target.checked ? 3 : 0)} /> Allow photos for this product</label>
    {value > 0 && <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>Maximum photos per claim <select aria-label="Maximum photos per claim" value={value} disabled={disabled} onChange={event => onChange(Number(event.target.value))} style={{ maxWidth: 90 }}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label>}
    <p className="business-hint">Customers can attach up to {value || "zero"} photos when they submit a claim. Changing this does not remove photos from existing claims.</p>
  </div>;
}

export function ProductClaimPhotos({ sessionId, productId, initialLimit }: { sessionId: string; productId: string; initialLimit: number }) {
  const [limit, setLimit] = useState(initialLimit);
  const [savedLimit, setSavedLimit] = useState(initialLimit);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving || limit === savedLimit) return;
    setSaving(true); setNotice(""); setError("");
    try {
      const result = await apiFetch(`/api/demo/${sessionId}/brand/products/${productId}/claim-photos`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimPhotoLimit: limit }) }).then(readApiResponse);
      setSavedLimit(result.claimPhotoLimit); setNotice("Claim photo settings saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save photo settings."); }
    finally { setSaving(false); }
  }
  return <section className="business-panel"><div className="business-panel-header"><div><h2>Claim photos</h2><p>Choose whether customers can attach photos for this product.</p></div></div><form className="business-form-section" onSubmit={save}><ClaimPhotoLimitField value={limit} onChange={value => { setLimit(value); setNotice(""); }} disabled={saving}/>{error && <p role="alert" className="issue-tag-error">{error}</p>}<div className="issue-tag-save"><span role="status">{notice}</span><button type="submit" className="business-button primary" disabled={saving || limit === savedLimit}>{saving ? "Saving…" : "Save photo settings"}</button></div></form></section>;
}
