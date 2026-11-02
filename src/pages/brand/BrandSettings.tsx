import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export function BrandSettings() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [brand, setBrand] = useState<any>(null);
  const [name, setName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [policyDays, setPolicyDays] = useState<string>("");
  const [customDays, setCustomDays] = useState("");
  const [lateAction, setLateAction] = useState<"REJECT" | "MANUAL_REVIEW">("REJECT");
  const [policySaving, setPolicySaving] = useState(false);
  const [policyNotice, setPolicyNotice] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    apiFetch(`/api/demo/${sessionId}/brand/settings`)
      .then((res) => res.json())
      .then((data) => {
        if (data.brand) {
          setBrand(data.brand);
          setName(data.brand.name || "");
          setSupportEmail(data.brand.supportEmail || "");
          const days = data.policy?.registrationWindowDays ?? null;
          setPolicyDays(days == null ? "" : [7, 30, 90].includes(days) ? String(days) : "custom");
          setCustomDays(days == null ? "" : String(days));
          setLateAction(data.policy?.lateRegistrationAction || "REJECT");
        }
      }).catch(() => setPolicyNotice("Could not load registration policy.")).finally(() => setLoading(false));
  }, [sessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;
    setSaving(true);
    setNotice(null);

    try {
      const res = await apiFetch(`/api/demo/${sessionId}/brand/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, supportEmail, removeLogo, logoDataUrl: logo ? await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(logo); }) : undefined }),
      });
      const data = await readApiResponse(res);
      if (res.ok) {
        setBrand(data.brand); setLogo(null); setRemoveLogo(false); setNotice("Brand details saved.");
      } else {
        setNotice(data.error || "Failed to save settings.");
      }
    } catch {
      setNotice("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const savePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || policySaving) return;
    const days = policyDays === "" ? null : policyDays === "custom" ? Number(customDays) : Number(policyDays);
    if (policyDays === "custom" && (!/^\d+$/.test(customDays) || !Number.isInteger(days) || days! < 1 || days! > 3650)) {
      setPolicyNotice("Enter a whole number of days between 1 and 3650."); return;
    }
    setPolicySaving(true); setPolicyNotice("");
    try {
      await readApiResponse(await apiFetch(`/api/demo/${sessionId}/brand/registration-policy`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registrationWindowDays: days, lateRegistrationAction: lateAction }) }));
      setPolicyNotice("Registration policy saved.");
    } catch (error) { setPolicyNotice(error instanceof Error ? error.message : "Could not save registration policy."); }
    finally { setPolicySaving(false); }
  };

  return (
    <div style={{ maxWidth: "680px" }}>
      <div className="business-page-header">
        <div>
          <div className="business-eyebrow">Workspace Configuration</div>
          <h1>Brand Settings</h1>
          <p>Configure brand profile, support contact email, and warranty notifications.</p>
        </div>
      </div>

      {notice && <div className="business-notice">{notice}</div>}

      <div className="business-panel">
        <form onSubmit={handleSubmit} className="business-form-section">
          <div className="business-field">
            <label>Brand Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="business-field">
            <label>Customer Support Email</label>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder="support@brand.com"
            />
          </div>

          <div className="business-field">
            <label>Brand logo <span>Optional · PNG, JPG or WebP up to 5 MB</span></label>
            {brand?.logoUrl && <img src={brand.logoUrl} alt="Current brand logo" style={{ width: 72, height: 72, objectFit: "contain", border: "1px solid #e2e6de", borderRadius: 8, padding: 6 }} />}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { setLogo(e.target.files?.[0] || null); if (e.target.files?.[0]) setRemoveLogo(false); }} />
            {brand?.logoUrl && <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}><input type="checkbox" checked={removeLogo} onChange={(e) => setRemoveLogo(e.target.checked)} /> Remove current logo</label>}
          </div>

          <div className="business-field">
            <label>Workspace identifier</label>
            <input type="text" value={sessionId || ""} disabled style={{ background: "#f5f6f3", color: "#777" }} />
          </div>

          <button type="submit" disabled={saving} className="business-button primary">
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </form>
      </div>
      <div className="business-panel" style={{ marginTop: 20 }}>
        <form onSubmit={savePolicy} className="business-form-section">
          <h2>Registration Policy</h2>
          <p>Choose how long customers have to register their products after delivery.</p>
          {loading ? <p>Loading policy…</p> : <>
            <div className="business-field"><label htmlFor="registration-window">Registration window</label><select id="registration-window" value={policyDays} onChange={event => setPolicyDays(event.target.value)}><option value="">No deadline</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="custom">Custom duration</option></select></div>
            {policyDays === "custom" && <div className="business-field"><label htmlFor="custom-registration-days">Custom number of days</label><input id="custom-registration-days" type="number" min="1" max="3650" step="1" value={customDays} onChange={event => setCustomDays(event.target.value)} required /><small>Enter 1 to 3650 whole days.</small></div>}
            {policyDays !== "" && <div className="business-field"><label htmlFor="late-registration-action">Late registration requests</label><p>Choose how Vouch handles registrations submitted after the allowed period.</p><select id="late-registration-action" value={lateAction} onChange={event => setLateAction(event.target.value as "REJECT" | "MANUAL_REVIEW")}><option value="REJECT">Automatically reject</option><option value="MANUAL_REVIEW">Send for manual approval</option></select></div>}
            {policyNotice && <div className="business-notice" role="status">{policyNotice}</div>}
            <button type="submit" className="business-button primary" disabled={policySaving}>{policySaving ? "Saving…" : "Save Changes"}</button>
          </>}
        </form>
      </div>
    </div>
  );
}
export default BrandSettings;
