import { useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";

const steps: Record<string, string[]> = {
  REPAIR: ["COLLECTION_ARRANGED", "RECEIVED", "REPAIR_IN_PROGRESS", "REPAIR_COMPLETED", "RETURN_DISPATCHED"],
  REPLACEMENT: ["REPLACEMENT_PREPARED", "REPLACEMENT_DISPATCHED", "REPLACEMENT_DELIVERED"],
  REFUND: ["REFUND_INITIATED", "REFUND_COMPLETED"],
};
const label = (text: string) => text.toLowerCase().replaceAll("_", " ").replace(/^./, first => first.toUpperCase());

export function ClaimResolutionPanel({ sessionId, claim, onChanged }: { sessionId: string; claim: any; onChanged: () => void }) {
  const resolution = claim.resolution;
  const [type, setType] = useState(resolution?.type ?? claim.resolutionMethod ?? "REPAIR");
  const [step, setStep] = useState("");
  const [occurredOn, setOccurredOn] = useState("");
  const [serviceReference, setServiceReference] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [courier, setCourier] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundCurrency, setRefundCurrency] = useState("INR");
  const [replacementUnitCode, setReplacementUnitCode] = useState("");
  const [replacementUnitId, setReplacementUnitId] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  if (!["APPROVED", "RESOLVED"].includes(claim.status)) return null;
  const available: string[] = resolution && steps[resolution.type]?.filter((value: string) => steps[resolution.type].indexOf(value) > steps[resolution.type].indexOf(resolution.step)) || [];
  const prerequisite = resolution?.type === "REPAIR" ? "REPAIR_COMPLETED" : resolution?.type === "REPLACEMENT" ? "REPLACEMENT_DELIVERED" : "REFUND_COMPLETED";
  const canComplete = resolution?.status === "IN_PROGRESS" && (resolution.step === prerequisite || steps[resolution.type]?.indexOf(resolution.step) > steps[resolution.type]?.indexOf(prerequisite)) && (resolution.type !== "REPLACEMENT" || Boolean(resolution.replacementUnitId));

  async function findReplacement() {
    setError(""); setReplacementUnitId("");
    if (!replacementUnitCode.trim()) return;
    try {
      const result = await apiFetch(`/api/demo/${sessionId}/brand/units/search?q=${encodeURIComponent(replacementUnitCode.trim())}`).then(readApiResponse);
      const match = (result.units ?? []).find((unit: any) => unit.serialNumber === replacementUnitCode.trim().toUpperCase());
      if (!match) throw new Error("No exact Unit ID was found in this brand.");
      if (match.purchaseOrder || match.registration) throw new Error("Choose an unassigned, unregistered unit.");
      setReplacementUnitId(match.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not find replacement unit."); }
  }
  async function submit(action: string) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (type === "REPLACEMENT" && replacementUnitCode && !replacementUnitId) throw new Error("Find and select the replacement unit first.");
      const body = { action, requestId: crypto.randomUUID(), type, step: action === "PROGRESS" ? step : undefined, occurredOn, serviceReference, trackingNumber, courier, refundAmount: type === "REFUND" ? refundAmount : undefined, refundCurrency: type === "REFUND" && refundAmount ? refundCurrency : undefined, replacementUnitId: type === "REPLACEMENT" ? replacementUnitId || undefined : undefined, internalNote, customerMessage };
      await apiFetch(`/api/demo/${sessionId}/brand/claims/${claim.id}/resolution`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(readApiResponse);
      setNotice(action === "COMPLETE" ? "Resolution completed and claim closed." : "Resolution updated."); setEditing(false); setInternalNote(""); setCustomerMessage(""); setStep(""); onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update the resolution."); }
    finally { setBusy(false); }
  }
  return <section className="business-panel" aria-label="Resolution">
    <div className="business-panel-header"><div><h2>Resolution</h2><p>{!resolution ? "This claim has been approved. Choose how you plan to resolve it." : `${label(resolution.type)} · ${label(resolution.status)} · ${label(resolution.step)}`}</p></div>{resolution?.status === "IN_PROGRESS" && <button type="button" className="business-button small" onClick={() => setEditing((value: boolean) => !value)}>{editing ? "Close" : "Update Progress"}</button>}</div>
    <div className="business-form-section">
      {error && <p className="business-notice error" role="alert">{error}</p>}{notice && <p className="business-notice" role="status">{notice}</p>}
      {resolution && <><p>Started {new Date(resolution.startedAt).toLocaleDateString()} · Last updated {new Date(resolution.updatedAt).toLocaleString()}{resolution.completedAt ? ` · Completed ${new Date(resolution.completedAt).toLocaleDateString()}` : ""}</p>
        {resolution.serviceReference && <p>Reference: {resolution.serviceReference}</p>}{resolution.trackingNumber && <p>Tracking: {resolution.trackingNumber}{resolution.courier ? ` · ${resolution.courier}` : ""}</p>}{resolution.replacementUnit && <p>Replacement unit: {resolution.replacementUnit.serialNumber}. Warranty coverage remains on the original registration until an authorized transfer is supported.</p>}{resolution.type === "REFUND" && <p>Refund is tracked from the brand&apos;s records only. No payment is processed or externally verified in Vouch.</p>}
        <ol>{resolution.events?.map((event: any) => <li key={event.id} style={{ marginBottom: 8 }}><strong>{label(event.action)} · {label(event.toStep)}</strong> — {new Date(event.createdAt).toLocaleString()}{event.referenceNumber ? ` · ${event.referenceNumber}` : ""}{event.internalNote && <p>Internal: {event.internalNote}</p>}{event.customerMessage && <p>Customer update: {event.customerMessage}</p>}</li>)}</ol>
      </>}
      {!resolution && <><label className="business-field"><span>Resolution type</span><select value={type} onChange={event => setType(event.target.value)}><option value="REPAIR">Repair</option><option value="REPLACEMENT">Replacement</option><option value="REFUND">Refund</option></select></label><label className="business-field"><span>Internal note (optional)</span><textarea value={internalNote} maxLength={2000} onChange={event => setInternalNote(event.target.value)}/></label><button type="button" className="business-button primary" disabled={busy} onClick={() => submit("START")}>{busy ? "Saving…" : "Start Resolution"}</button></>}
      {resolution?.status === "CANCELLED" && <><p>This resolution was cancelled. Restarting records a new event and keeps the earlier history.</p><label className="business-field"><span>New resolution type</span><select value={type} onChange={event => setType(event.target.value)}><option value="REPAIR">Repair</option><option value="REPLACEMENT">Replacement</option><option value="REFUND">Refund</option></select></label><label className="business-field"><span>Reason for restart *</span><textarea value={internalNote} onChange={event => setInternalNote(event.target.value)} maxLength={2000}/></label><button type="button" className="business-button primary" disabled={busy || !internalNote.trim()} onClick={() => submit("RESTART")}>Start a New Resolution</button></>}
      {resolution?.status === "IN_PROGRESS" && editing && <div style={{ display: "grid", gap: 12 }}>
        <label className="business-field"><span>Next step</span><select value={step} onChange={event => setStep(event.target.value)}><option value="">Choose a progress step</option>{available.map((value: string) => <option value={value} key={value}>{label(value)}</option>)}</select></label>
        <label className="business-field"><span>Event date (optional)</span><input type="date" value={occurredOn} max={new Date().toISOString().slice(0, 10)} onChange={event => setOccurredOn(event.target.value)}/></label>
        <label className="business-field"><span>Service or refund reference (optional)</span><input value={serviceReference} maxLength={120} onChange={event => setServiceReference(event.target.value)}/></label>
        {resolution.type !== "REFUND" && <><label className="business-field"><span>Courier (optional)</span><input value={courier} maxLength={100} onChange={event => setCourier(event.target.value)}/></label><label className="business-field"><span>Tracking number (optional)</span><input value={trackingNumber} maxLength={120} onChange={event => setTrackingNumber(event.target.value)}/></label></>}
        {resolution.type === "REFUND" && <div style={{ display: "flex", gap: 10 }}><label className="business-field"><span>Refund amount (optional)</span><input type="number" min="0" step="0.01" value={refundAmount} onChange={event => setRefundAmount(event.target.value)}/></label><label className="business-field"><span>Currency</span><input value={refundCurrency} maxLength={3} onChange={event => setRefundCurrency(event.target.value.toUpperCase())}/></label></div>}
        {resolution.type === "REPLACEMENT" && <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}><label className="business-field"><span>Replacement Unit ID (required before completion)</span><input value={replacementUnitCode} onChange={event => { setReplacementUnitCode(event.target.value.toUpperCase()); setReplacementUnitId(""); }}/></label><button type="button" className="business-button" onClick={findReplacement}>Find Unit</button>{replacementUnitId && <span>Unit selected</span>}</div>}
        <label className="business-field"><span>Internal note (brand only)</span><textarea value={internalNote} maxLength={2000} onChange={event => setInternalNote(event.target.value)}/></label><label className="business-field"><span>Customer update (optional)</span><textarea value={customerMessage} maxLength={500} onChange={event => setCustomerMessage(event.target.value)}/></label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button type="button" className="business-button primary" disabled={busy || !step} onClick={() => submit("PROGRESS")}>Save Progress</button><button type="button" className="business-button" disabled={busy || !canComplete} onClick={() => submit("COMPLETE")}>Complete Resolution</button><button type="button" className="business-button" disabled={busy || !internalNote.trim()} onClick={() => submit("CANCEL")}>Cancel Resolution</button></div>
        {!canComplete && <p>Record {label(prerequisite)}{resolution.type === "REPLACEMENT" ? " and link the replacement Unit ID" : ""} before completing this resolution.</p>}
        {resolution.step === "STARTED" && <div style={{ borderTop: "1px solid #e4e4e4", paddingTop: 12 }}><label className="business-field"><span>Change resolution type</span><select value={type} onChange={event => setType(event.target.value)}><option value="REPAIR">Repair</option><option value="REPLACEMENT">Replacement</option><option value="REFUND">Refund</option></select></label><button type="button" className="business-button" disabled={busy || type === resolution.type || !internalNote.trim()} onClick={() => submit("CHANGE_TYPE")}>Change Type with Note</button></div>}
      </div>}
    </div>
  </section>;
}
