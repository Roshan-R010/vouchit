import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";

export type TemplateCategory = "APPROVE" | "REJECT" | "REQUEST_INFO";
export type ClaimTemplate = { id: string; name: string; category: TemplateCategory; body: string };

export function ClaimTemplatePicker({ sessionId, category, value, onInsert, disabled }: {
  sessionId: string; category: TemplateCategory; value: string; onInsert: (body: string) => void; disabled?: boolean;
}) {
  const [templates, setTemplates] = useState<ClaimTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch(`/api/demo/${sessionId}/brand/claim-templates`, { cache: "no-store" }).then(readApiResponse)
      .then(data => { if (active) { setTemplates(Array.isArray(data.templates) ? data.templates : []); setError(""); } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Could not load templates."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionId]);
  const choices = templates.filter(template => template.category === category);
  return <div style={{ margin: "8px 0 12px", fontSize: 13 }}>
    <label htmlFor={`template-${category}`} style={{ display: "block", marginBottom: 5 }}>Use template</label>
    {loading ? <span>Loading templates…</span> : error ? <span role="alert">{error}</span> : choices.length ?
      <select id={`template-${category}`} value="" disabled={disabled} onChange={event => {
        const template = choices.find(item => item.id === event.target.value);
        if (!template) return;
        if (value.trim() && !window.confirm("Replace your unsaved message with this template?")) return;
        onInsert(template.body);
      }} style={{ width: "100%", padding: 8 }}>
        <option value="">Choose a template…</option>
        {choices.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
      </select> : <span>No templates for this action. </span>}
    <Link to={`/demo/${sessionId}/brand/settings#claim-templates`} style={{ display: "inline-block", marginTop: 5 }}>Manage templates</Link>
  </div>;
}
