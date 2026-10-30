import { Select } from "@/components/select";
import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import styles from "./product-claim-photos.module.css";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";

export function ClaimPhotoLimitField({ value, onChange, disabled = false }: { value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return <div className={styles.settings}>
    <label className={styles.photoToggle}>
      <input className={styles.checkbox} type="checkbox" checked={value > 0} disabled={disabled} onChange={event => onChange(event.target.checked ? 3 : 0)}/>
      <span className={styles.checkboxFace} aria-hidden="true"><Check size={15} strokeWidth={3}/></span>
      <span>Allow photos for this product</span>
    </label>
    {value > 0 && <label className={styles.limitRow}>
      <span className={styles.limitLabel}>Maximum photos per claim</span>
      <Select className={styles.dropdown} value={value} disabled={disabled} aria-label="Maximum photos per claim" onChange={event => onChange(Number(event.target.value))}>
        {[1, 2, 3].map(count => <option key={count} value={count}>{count} {count === 1 ? "photo" : "photos"}</option>)}
      </Select>
    </label>}
    <p className={styles.hint}>{value > 0 ? `Customers can attach up to ${value} ${value === 1 ? "photo" : "photos"} when they submit a claim.` : "Customers cannot attach photos when they submit a claim."} Changing this does not remove photos from existing claims.</p>
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
  return <section className={`${styles.panel} business-panel`}><div className="business-panel-header"><div><h2>Claim photos</h2><p>Choose whether customers can attach photos for this product.</p></div></div><form className="business-form-section" onSubmit={save}><ClaimPhotoLimitField value={limit} onChange={value => { setLimit(value); setNotice(""); }} disabled={saving}/>{error && <p role="alert" className="issue-tag-error">{error}</p>}<div className="issue-tag-save"><span role="status">{notice}</span><button type="submit" className="business-button primary" disabled={saving || limit === savedLimit}>{saving ? "Saving…" : "Save photo settings"}</button></div></form></section>;
}
