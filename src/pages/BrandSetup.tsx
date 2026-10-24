import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

function asDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
}

export default function BrandSetup() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sessionId) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/demo/${sessionId}/brand/setup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, supportEmail, logoDataUrl: logo ? await asDataUrl(logo) : undefined }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create your brand.");
      navigate(`/demo/${sessionId}/brand`, { replace: true });
    } catch (cause: any) { setError(cause.message || "Could not create your brand."); }
    finally { setSaving(false); }
  };

  return <main className="business-setup"><div className="business-form-page"><div className="business-logo"><span>v</span>vouch<span className="business-logo-label">Business</span></div><div className="business-page-header"><div><div className="business-eyebrow">New workspace</div><h1>Build your warranty experience.</h1><p>Start with your brand, then add products and units for customers to register.</p></div></div>{error && <div className="business-notice error">{error}</div>}<form onSubmit={submit}><section className="business-panel"><div className="business-panel-header"><div><h2>Create your brand</h2><p>These details will be visible to your customers.</p></div></div><div className="business-form-section"><div className="business-field"><label htmlFor="brand-name">Brand name</label><input id="brand-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required placeholder="e.g. Acme Goods"/></div><div className="business-field"><label htmlFor="brand-email">Support email <span>Optional</span></label><input id="brand-email" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} maxLength={200} placeholder="support@example.com"/></div><div className="business-field"><label htmlFor="brand-logo">Brand logo <span>Optional · PNG, JPG or WebP up to 5 MB</span></label><input id="brand-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setLogo(e.target.files?.[0] || null)}/></div></div></section><div className="business-form-footer"><button className="business-button primary" disabled={saving}>{saving ? "Creating…" : "Create brand"}</button></div></form></div></main>;
}
