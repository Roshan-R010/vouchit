"use client";
import { Select } from "@/components/select";

import { useActionState, useState } from "react";
import type { ClaimStatus } from "@prisma/client";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { changeBrandClaimStatusAction, type BrandClaimActionState } from "@/app/brand-claim-actions";
import styles from "./brand-claims.module.css";

export function BrandClaimActions({ sessionId, claimId, status }: { sessionId: string; claimId: string; status: ClaimStatus }) {
  const [decision, setDecision] = useState("approve");
  const [state, action, pending] = useActionState(changeBrandClaimStatusAction.bind(null, sessionId, claimId), {} as BrandClaimActionState);
  const terminal = status === "REJECTED" || status === "RESOLVED";

  return <section className={styles.panel}>
    <div className={styles.panelHeading}><h2>Next action</h2></div>
    {state.error && <p className={styles.error} role="alert">{state.error}</p>}
    {state.success && <p className={styles.success} role="status"><Check size={15} />{state.success}</p>}
    {terminal ? <p className={styles.muted}>This claim is {status === "RESOLVED" ? "resolved" : "closed with a rejection"}. Its decision and history remain available to the customer.</p>
      : status === "INFO_REQUESTED" ? <p className={styles.muted}>Waiting for the customer’s reply. Their response will move this claim back to In review.</p>
      : <form action={action} className={styles.actionForm}>
        {status === "SUBMITTED" ? <><input type="hidden" name="decision" value="review" /><p className={styles.muted}>Start reviewing the linked product, order and warranty details.</p><button className={styles.primaryButton} disabled={pending}>{pending ? <Loader2 size={15} className={styles.spin} /> : <ArrowRight size={15} />}Mark in review</button></>
          : status === "APPROVED" ? <><input type="hidden" name="decision" value="resolve" /><p className={styles.muted}>Mark resolved once the repair or replacement has been completed.</p><label>Resolution<Select name="resolutionMethod" required><option value="REPAIR">Repair completed</option><option value="REPLACEMENT">Replacement completed</option></Select></label><label>Outcome<textarea name="note" maxLength={2000} required rows={4} placeholder="Describe what was repaired or replaced…" /></label><button className={styles.primaryButton} disabled={pending}>{pending && <Loader2 size={15} className={styles.spin} />}Mark resolved</button></>
          : <><label>Decision<Select name="decision" value={decision} onChange={(event) => setDecision(event.target.value)}><option value="approve">Approve claim</option><option value="request_info">Ask for more information</option><option value="reject">Reject claim</option></Select></label><label>{decision === "request_info" ? "Question for the customer" : decision === "reject" ? "Reason for rejection" : "Message to the customer (optional)"}<textarea name="note" maxLength={2000} required={decision !== "approve"} rows={4} placeholder={decision === "request_info" ? "What additional information do you need?" : decision === "reject" ? "Explain why this claim cannot be approved…" : "Add any next steps for the customer…"} /></label>{decision === "approve" && <p className={styles.hint}>Approval confirms the decision. You can record a completed repair or replacement afterward.</p>}<button className={decision === "reject" ? styles.dangerButton : styles.primaryButton} disabled={pending}>{pending && <Loader2 size={15} className={styles.spin} />}{decision === "request_info" ? "Send information request" : decision === "reject" ? "Reject claim" : "Approve claim"}</button></>}
      </form>}
  </section>;
}
