"use client";

import { useActionState, useState } from "react";
import { submitClaimAction, type ClaimActionState } from "@/app/actions";
import { ImagePicker } from "@/components/image-picker";

export function ClaimForm({ sessionId, unitId, submissionId }: { sessionId: string; unitId: string; submissionId: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [state, action, pending] = useActionState(async (previous: ClaimActionState, form: FormData) => {
    form.delete("photos");
    files.forEach((file) => form.append("photos", file));
    return submitClaimAction(previous, form);
  }, {});
  return <form action={action}>
    <input type="hidden" name="sessionId" value={sessionId}/><input type="hidden" name="unitId" value={unitId}/><input type="hidden" name="submissionId" value={submissionId}/>
    <div className="field"><label htmlFor="issueTitle">What’s the issue?</label><input id="issueTitle" name="issueTitle" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} placeholder="Describe the issue briefly"/></div>
    <div className="field"><label htmlFor="description">Tell us a little more</label><textarea id="description" name="description" value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={3000} placeholder="What happened, and what have you tried?"/></div>
    <ImagePicker id="claim-photos" name="photos" label="Photos of the issue (optional)" files={files} onChange={setFiles} maxFiles={3}/>
    {state.error && <div className="notice error" role="alert">{state.error}</div>}
    <button className="action" type="submit" disabled={pending}>{pending ? "Uploading and submitting…" : "Submit claim"}</button>
    <p className="muted" style={{ fontSize: 11, marginTop: 14 }}>Your photos will be shared with the brand alongside this claim.</p>
  </form>;
}
