import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import styles from "./product-claim-photos.module.css";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";

export function ClaimPhotoLimitField({ value, onChange, disabled = false }: { value: number; onChange: (value: number) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div className={styles.settings}>
    <label className={styles.photoToggle}>
      <input className={styles.checkbox} type="checkbox" checked={value > 0} disabled={disabled} onChange={event => { onChange(event.target.checked ? 3 : 0); setOpen(false); }}/>
      <span className={styles.checkboxFace} aria-hidden="true"><Check size={15} strokeWidth={3}/></span>
      <span>Allow photos for this product</span>
    </label>
    {value > 0 && <div className={styles.limitRow}>
      <span id="claim-photo-limit-label" className={styles.limitLabel}>Maximum photos per claim</span>
      <div className={styles.dropdown} ref={dropdownRef}>
        <button type="button" className={styles.dropdownTrigger} aria-label={`Maximum photos per claim: ${value}`} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen(current => !current)} onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (open) onChange(Math.min(3, Math.max(1, value + (event.key === "ArrowDown" ? 1 : -1))));
            else setOpen(true);
          }
        }}><span>{value} {value === 1 ? "photo" : "photos"}</span><ChevronDown size={18} className={open ? styles.chevronOpen : ""}/></button>
        {open && <div className={styles.dropdownMenu} role="listbox" aria-labelledby="claim-photo-limit-label">{[1, 2, 3].map(count => <button type="button" role="option" aria-selected={value === count} className={styles.dropdownOption} key={count} onClick={() => { onChange(count); setOpen(false); dropdownRef.current?.querySelector<HTMLButtonElement>(`button.${styles.dropdownTrigger}`)?.focus(); }}>{count} {count === 1 ? "photo" : "photos"}{value === count && <Check size={16} aria-hidden="true"/>}</button>)}</div>}
      </div>
    </div>}
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
