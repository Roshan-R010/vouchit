import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";

export default function CustomerSettings() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch("/api/account/customer/settings").then(readApiResponse).then(data => {
      if (active) { setEmail(data.email); setLoaded(true); }
    }).catch(() => { if (active) setError("Could not load your settings. Please refresh and try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const data = await apiFetch("/api/account/customer/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
      }).then(readApiResponse);
      setEmail(data.email);
      setNotice("Email saved. New warranty registration confirmations will be sent here.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your email.");
    } finally { setSaving(false); }
  }

  return <main className="page-wrap form-shell" style={{ margin: "40px auto", maxWidth: 640 }}>
    <div className="form-header"><h1>Settings</h1><p>Choose where you receive your warranty confirmations.</p></div>
    <div className="form-body">
      {loading ? <p role="status">Loading your settings…</p> : <form onSubmit={save}>
        <div className="field">
          <label htmlFor="customer-email">Email address</label>
          <input id="customer-email" name="email" type="email" autoComplete="email" required maxLength={254}
            value={email} disabled={!loaded || saving} onChange={event => { setEmail(event.target.value); setNotice(""); }}
            aria-describedby="customer-email-help" />
          <small id="customer-email-help">We’ll send a confirmation here when you register a product.</small>
        </div>
        {notice && <p className="notice" role="status">{notice}</p>}
        <button className="action" type="submit" disabled={!loaded || saving}>{saving ? "Saving…" : "Save email"}</button>
      </form>}
      {error && <p className="notice error" role="alert">{error}</p>}
    </div>
  </main>;
}
