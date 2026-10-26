import { useState } from "react";
import { IssueTagEditor } from "@/components/issue-tag-editor";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";

export function ProductIssueTags({ sessionId, productId, initialTags }: { sessionId: string; productId: string; initialTags: string[] }) {
  const [tags, setTags] = useState(initialTags);
  const [savedTags, setSavedTags] = useState(initialTags);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const changed = JSON.stringify(tags) !== JSON.stringify(savedTags);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !changed) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await apiFetch(`/api/demo/${sessionId}/brand/products/${productId}/issue-tags`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ issueTags: tags }) }).then(readApiResponse);
      setTags(result.issueTags); setSavedTags(result.issueTags); setNotice("Issue tags saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save issue tags."); }
    finally { setSaving(false); }
  }
  return <section className="business-panel">
    <div className="business-panel-header"><div><h2>Claim issue tags</h2><p>Set the options customers see for this product. Tags on earlier claims stay as submitted.</p></div></div>
    <form className="business-form-section" onSubmit={save}>
      <IssueTagEditor value={tags} onChange={next => { setTags(next); setNotice(""); }} disabled={saving}/>
      {error && <p className="issue-tag-error" role="alert">{error}</p>}
      <div className="issue-tag-save"><span role="status">{notice}</span><button type="submit" className="business-button primary" disabled={!changed || saving}>{saving ? "Saving…" : "Save issue tags"}</button></div>
    </form>
  </section>;
}
