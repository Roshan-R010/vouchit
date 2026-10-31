import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";

const labels: Record<string, string> = { PENDING: "Pending", DELIVERED: "Delivered", RETURNED: "Returned", FOR_SALE_AGAIN: "For Sale Again" };

export function BrandUnitLifecycle({ sessionId, unitId, onChanged, onClose }: { sessionId: string; unitId: string; onChanged: () => void; onClose: () => void }) {
  const [unit, setUnit] = useState<any>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReturn, setConfirmReturn] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [deliveredOn, setDeliveredOn] = useState("");
  const load = () => apiFetch(`/api/demo/${sessionId}/brand/units/${unitId}/history`).then(readApiResponse).then(data => setUnit(data.unit)).catch(cause => setError(cause instanceof Error ? cause.message : "Could not load unit history."));
  useEffect(() => { load(); }, [sessionId, unitId]);
  async function act(type: string, extra: Record<string, string> = {}) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await apiFetch(`/api/demo/${sessionId}/brand/units/${unitId}/lifecycle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, ...extra }) });
      await readApiResponse(response);
      setConfirmReturn(false); setOrderNumber(""); setDeliveredOn("");
      setMessage(type === "RETURN" ? "Unit returned and active warranty ended." : "Unit updated.");
      await load(); onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update the unit."); }
    finally { setBusy(false); }
  }
  return <section className="business-panel" aria-label="Unit details">
    <div className="business-panel-header"><div><h2>{unit?.serialNumber ?? "Unit details"}</h2><p>{unit?.productModel?.name}</p></div><button type="button" className="business-button small" onClick={onClose}>Close</button></div>
    <div className="business-form-section">
      {error && <p className="business-notice error" role="alert">{error}</p>}{message && <p className="business-notice" role="status">{message}</p>}
      {unit && <><p>Current status: <strong>{labels[unit.status] ?? unit.status}</strong> · Current order: <strong>{unit.purchaseOrder?.orderNumber ?? "None"}</strong> · Warranty: <strong>{unit.registration ? `Active through ${new Date(unit.registration.coverageEndsOn).toLocaleDateString()}` : "No active warranty"}</strong></p>
        <p>Previous returns: {unit.events.filter((event: any) => event.eventType === "RETURNED").length}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {(unit.status === "PENDING" || unit.status === "DELIVERED") && unit.purchaseOrder && <button type="button" className="business-button" disabled={busy} onClick={() => setConfirmReturn(true)}>Mark Returned</button>}
          {unit.status === "RETURNED" && <button type="button" className="business-button" disabled={busy} onClick={() => act("FOR_SALE_AGAIN")}>Mark For Sale Again</button>}
        </div>
        {unit.status === "FOR_SALE_AGAIN" && <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}><label className="business-field"><span>New Order ID</span><input value={orderNumber} maxLength={120} onChange={event => setOrderNumber(event.target.value)}/></label><button type="button" className="business-button primary" disabled={busy || !orderNumber.trim()} onClick={() => act("ASSOCIATE_ORDER", { orderNumber })}>Associate New Order</button></div>}
        {unit.status === "PENDING" && unit.purchaseOrder && <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}><label className="business-field"><span>Confirmed delivery date</span><input type="date" value={deliveredOn} max={new Date().toISOString().slice(0, 10)} onChange={event => setDeliveredOn(event.target.value)}/></label><button type="button" className="business-button primary" disabled={busy || !deliveredOn} onClick={() => act("DELIVER", { deliveredOn })}>Confirm Delivery</button></div>}
        <h3>Unit history</h3><ol>{unit.events.map((event: any) => <li key={event.id}><time>{new Date(event.createdAt).toLocaleString()}</time> — {event.eventType.replaceAll("_", " ").toLowerCase()}{event.orderNumber ? ` · ${event.orderNumber}` : ""}{event.detail ? ` · ${event.detail}` : ""} <span style={{ color: "#777" }}>({event.source})</span></li>)}</ol>
      </>}
    </div>
    {confirmReturn && <div role="dialog" aria-modal="true" aria-labelledby="return-title" className="business-form-section" style={{ borderTop: "1px solid #ddd" }}><h3 id="return-title">Mark unit as returned?</h3><p>This will deactivate the customer&apos;s warranty and remove the product from their active warranty dashboard. The unit&apos;s history will be preserved.</p><div style={{ display: "flex", gap: 10 }}><button type="button" className="business-button" onClick={() => setConfirmReturn(false)} disabled={busy}>Cancel</button><button type="button" className="business-button primary" onClick={() => act("RETURN")} disabled={busy}>{busy ? "Saving…" : "Confirm Return"}</button></div></div>}
  </section>;
}
