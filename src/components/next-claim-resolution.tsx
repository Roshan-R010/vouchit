"use client";

import { useActionState, useState } from "react";
import { saveBrandResolutionAction } from "@/app/brand-resolution-actions";

const steps: Record<string, string[]> = {
  REPAIR: ["COLLECTION_ARRANGED", "RECEIVED", "REPAIR_IN_PROGRESS", "REPAIR_COMPLETED", "RETURN_DISPATCHED"],
  REPLACEMENT: ["REPLACEMENT_PREPARED", "REPLACEMENT_DISPATCHED", "REPLACEMENT_DELIVERED"],
  REFUND: ["REFUND_INITIATED", "REFUND_COMPLETED"],
};
const label = (value: string) => value.toLowerCase().replaceAll("_", " ");

export function NextClaimResolution({ sessionId, claimId, resolution }: { sessionId: string; claimId: string; resolution: { type: string; status: string; step: string; replacementUnitId?: string | null } | null }) {
  const [state, action, pending] = useActionState(saveBrandResolutionAction.bind(null, sessionId, claimId), {} as { error?: string; success?: string });
  const [type, setType] = useState(resolution?.type || "REPAIR");
  const [choice, setChoice] = useState(resolution?.status === "CANCELLED" ? "RESTART" : resolution ? "PROGRESS" : "START");
  const available = steps[resolution?.type || type].filter(step => !resolution || steps[resolution.type].indexOf(step) > steps[resolution.type].indexOf(resolution.step));
  const prerequisite = resolution?.type === "REPAIR" ? "REPAIR_COMPLETED" : resolution?.type === "REPLACEMENT" ? "REPLACEMENT_DELIVERED" : "REFUND_COMPLETED";
  const canComplete = resolution && steps[resolution.type].indexOf(resolution.step) >= steps[resolution.type].indexOf(prerequisite) && (resolution.type !== "REPLACEMENT" || Boolean(resolution.replacementUnitId));
  if (resolution?.status === "COMPLETED") return <p>Resolution completed.</p>;
  return <section style={{ display: "grid", gap: 12 }}>
    <h3>Resolution</h3>
    {resolution && <p>{label(resolution.type)} · {label(resolution.status)} · {label(resolution.step)}</p>}
    {state.error && <p role="alert">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}
    <form action={action} style={{ display: "grid", gap: 12 }}>
      <label>Action<select name="action" value={choice} onChange={event => setChoice(event.target.value)}>
        {!resolution && <option value="START">Start resolution</option>}
        {resolution?.status === "IN_PROGRESS" && <><option value="PROGRESS">Record progress</option>{canComplete && <option value="COMPLETE">Complete resolution</option>}{resolution.step === "STARTED" && <option value="CHANGE_TYPE">Change type</option>}<option value="CANCEL">Cancel resolution</option></>}
        {resolution?.status === "CANCELLED" && <option value="RESTART">Restart resolution</option>}
      </select></label>
      {["START", "RESTART", "CHANGE_TYPE"].includes(choice) && <label>Type<select name="type" value={type} onChange={event => setType(event.target.value)}><option value="REPAIR">Repair</option><option value="REPLACEMENT">Replacement</option><option value="REFUND">Refund</option></select></label>}
      {choice === "PROGRESS" && <label>Next step<select name="step" required><option value="">Choose a step</option>{available.map(step => <option key={step} value={step}>{label(step)}</option>)}</select></label>}
      {choice === "PROGRESS" && <><label>Service or refund reference<input name="serviceReference" maxLength={120}/></label><label>Courier<input name="courier" maxLength={100}/></label><label>Tracking number<input name="trackingNumber" maxLength={120}/></label>{type === "REFUND" && <><label>Refund amount<input name="refundAmount" type="number" min="0" step="0.01"/></label><label>Currency<input name="refundCurrency" defaultValue="INR" maxLength={3}/></label></>}<label>Replacement unit database ID, if assigned<input name="replacementUnitId"/></label></>}
      <label>Internal note<textarea name="internalNote" maxLength={2000} required={["CANCEL", "RESTART", "CHANGE_TYPE"].includes(choice)}/></label>
      <label>Customer update<textarea name="customerMessage" maxLength={500}/></label>
      <button type="submit" disabled={pending}>{pending ? "Saving…" : "Save resolution update"}</button>
    </form>
  </section>;
}
