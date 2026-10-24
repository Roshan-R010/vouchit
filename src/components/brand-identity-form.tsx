"use client";

import { useActionState, useState } from "react";
import { createBrandAction, saveBrandProfileAction, type BrandProfileState } from "@/app/brand-profile-actions";
import { ImagePicker } from "@/components/image-picker";

export function BrandIdentityForm({ sessionId, brand }: { sessionId: string; brand?: { name: string; supportEmail: string | null; logoUrl: string | null } }) {
  const [files, setFiles] = useState<File[]>([]);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [name, setName] = useState(brand?.name || "");
  const [email, setEmail] = useState(brand?.supportEmail || "");
  const [state, action, pending] = useActionState(async (previous: BrandProfileState, form: FormData) => {
    form.delete("logo");
    if (files[0]) form.set("logo", files[0]);
    const submit = brand ? saveBrandProfileAction : createBrandAction;
    return submit(sessionId, previous, form);
  }, {});
  return <form action={action} className="business-form-section">
    <ImagePicker id="brand-logo" name="logo" label="Brand logo" files={files} onChange={(value) => { setFiles(value); if (value.length) setRemoveLogo(false); }} initialUrl={removeLogo ? null : brand?.logoUrl}/>
    {brand?.logoUrl && <label className="business-check"><input type="checkbox" name="removeLogo" checked={removeLogo} onChange={(event) => { setRemoveLogo(event.target.checked); if (event.target.checked) setFiles([]); }}/>Remove current logo</label>}
    <div className="business-field"><label htmlFor="brand-name">Brand name</label><input id="brand-name" name="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your brand name" required maxLength={120}/></div>
    <div className="business-field"><label htmlFor="support-email">Support email</label><input id="support-email" name="supportEmail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="support@yourbrand.com"/></div>
    {state.error && <div className="business-notice error" role="alert">{state.error}</div>}
    {state.success && <div className="business-notice" role="status">{state.success}</div>}
    <button className="business-button primary" disabled={pending}>{pending ? "Saving…" : brand ? "Save brand details" : "Create brand"}</button>
  </form>;
}
