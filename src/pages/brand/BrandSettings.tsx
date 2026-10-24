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

  useEffect(() => {
    if (!sessionId) return;
    apiFetch(`/api/demo/${sessionId}/brand/settings`)
      .then((res) => res.json())
      .then((data) => {
        if (data.brand) {
          setBrand(data.brand);
          setName(data.brand.name || "");
          setSupportEmail(data.brand.supportEmail || "");
        }
      });
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
    </div>
  );
}
export default BrandSettings;
