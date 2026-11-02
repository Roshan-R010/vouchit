import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";
import type { ClaimTemplate, TemplateCategory } from "./claim-template-picker";

const empty = { id: "", name: "", category: "APPROVE" as TemplateCategory, body: "" };
const categories: { value: TemplateCategory; label: string }[] = [
  { value: "APPROVE", label: "Approve" }, { value: "REJECT", label: "Reject" }, { value: "REQUEST_INFO", label: "Request more information" },
];

export function ClaimTemplateManager({ sessionId }: { sessionId: string }) {
  const [templates, setTemplates] = useState<ClaimTemplate[]>([]);
  const [draft, setDraft] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try { const data = await apiFetch(`/api/demo/${sessionId}/brand/claim-templates`, { cache: "no-store" }).then(readApiResponse); setTemplates(Array.isArray(data.templates) ? data.templates : []); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load templates."); }
    finally { setLoading(false); }
  }, [sessionId]);
  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await apiFetch(`/api/demo/${sessionId}/brand/claim-templates${draft.id ? `/${draft.id}` : ""}`, {
        method: draft.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name.trim(), category: draft.category, body: draft.body.trim() }),
      }).then(readApiResponse);
      setDraft(empty); setNotice("Template saved."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save template."); }
    finally { setBusy(false); }
  }
  async function remove(template: ClaimTemplate) {
    if (busy || !window.confirm(`Delete “${template.name}”? Existing claim history will stay unchanged.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await apiFetch(`/api/demo/${sessionId}/brand/claim-templates/${template.id}`, { method: "DELETE" }).then(readApiResponse);
      if (draft.id === template.id) setDraft(empty);
      setNotice("Template deleted."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete template."); }
    finally { setBusy(false); }
  }
  return <section id="claim-templates" className="business-panel" style={{ marginTop: 20 }}>
    <div className="business-form-section">
      <h2>Claim Templates</h2><p>Save wording for claim decisions. You can edit it before submitting a claim action.</p>
      {loading ? <p>Loading templates…</p> : error && !templates.length ? null : templates.length ? <ul style={{ paddingLeft: 20 }}>
        {templates.map(template => <li key={template.id} style={{ marginBottom: 10 }}>
          <strong>{template.name}</strong> <small>({categories.find(item => item.value === template.category)?.label})</small>
          <p style={{ whiteSpace: "pre-wrap", margin: "4px 0" }}>{template.body}</p>
          <button type="button" className="business-button" disabled={busy} onClick={() => setDraft({ ...template })}>Edit</button>{" "}
          <button type="button" className="business-button" disabled={busy} onClick={() => void remove(template)}>Delete</button>
        </li>)}
      </ul> : <p>No templates yet. Create one below.</p>}
      <form onSubmit={save} className="business-form-section">
        <h3>{draft.id ? "Edit template" : "New template"}</h3>
        <div className="business-field"><label htmlFor="template-name">Name</label><input id="template-name" maxLength={100} required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })}/></div>
        <div className="business-field"><label htmlFor="template-category">Category</label><select id="template-category" value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value as TemplateCategory })}>{categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
        <div className="business-field"><label htmlFor="template-body">Message</label><textarea id="template-body" maxLength={2000} required rows={4} value={draft.body} onChange={event => setDraft({ ...draft, body: event.target.value })}/></div>
        <div><button className="business-button primary" disabled={busy || !draft.name.trim() || !draft.body.trim()}>{busy ? "Saving…" : "Save template"}</button>{draft.id && <> <button type="button" className="business-button" disabled={busy} onClick={() => setDraft(empty)}>Cancel edit</button></>}</div>
      </form>
      {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    </div>
  </section>;
}
