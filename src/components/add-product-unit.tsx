import { useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";

export function AddProductUnit({ sessionId, productId, onSaved }: { sessionId: string; productId: string; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return <section className="business-panel"><div className="business-panel-header"><div><h2>Add a delivered unit</h2><p>Use the serial number and delivery details from the actual purchase.</p></div></div><form className="business-form-section" onSubmit={async event => {
    event.preventDefault(); if(saving) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setSaving(true); setError("");
    try { await apiFetch(`/api/demo/${sessionId}/brand/products/${productId}/units`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }).then(readApiResponse); form.reset(); onSaved(); }
    catch(cause) { setError(cause instanceof Error ? cause.message : "Could not save the unit."); }
    finally { setSaving(false); }
  }}>{error && <p role="alert" className="business-notice error">{error}</p>}<div className="business-form-grid"><div className="business-field"><label htmlFor="unit-serial">Serial number</label><input id="unit-serial" name="serialNumber" required maxLength={120}/></div><div className="business-field"><label htmlFor="unit-order">Order reference</label><input id="unit-order" name="orderNumber" required maxLength={120}/></div><div className="business-field"><label htmlFor="unit-delivery">Delivery date</label><input id="unit-delivery" name="deliveredOn" type="date" required/></div></div><button className="business-button primary" disabled={saving}>{saving ? "Saving…" : "Save unit"}</button></form></section>;
}
