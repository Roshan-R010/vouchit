import { useId, useState } from "react";
import { X } from "lucide-react";
import { MAX_ISSUE_TAGS, MAX_ISSUE_TAG_LENGTH, normalizeIssueTags } from "@/lib/issue-tags";

export function IssueTagEditor({ value, onChange, disabled = false }: { value: string[]; onChange: (tags: string[]) => void; disabled?: boolean }) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const atLimit = value.length >= MAX_ISSUE_TAGS;
  function addTag() {
    if (!draft.trim() || disabled) return;
    try {
      onChange(normalizeIssueTags([...value, draft]));
      setDraft("");
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add tag."); }
  }
  return <div className="business-field issue-tag-editor">
    <label htmlFor={id}>Issue tags <span>{value.length}/{MAX_ISSUE_TAGS}</span></label>
    <p id={`${id}-hint`} className="issue-tag-hint">Add up to six common problems for this product. Customers can select the ones that match when raising a claim.</p>
    <div className="issue-tag-list" aria-label="Configured issue tags">{value.map(tag => <span className="issue-tag" key={tag}>{tag}<button type="button" disabled={disabled} aria-label={`Remove ${tag}`} onClick={() => { onChange(value.filter(item => item !== tag)); setError(""); }}><X size={14}/></button></span>)}</div>
    <div className="issue-tag-input"><input id={id} value={draft} maxLength={MAX_ISSUE_TAG_LENGTH} placeholder={atLimit ? "Six tags added" : "Enter an issue tag"} disabled={disabled || atLimit} aria-describedby={`${id}-hint`} aria-invalid={Boolean(error)} onChange={event => { setDraft(event.target.value); setError(""); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }}/><button className="business-button" type="button" onClick={addTag} disabled={disabled || atLimit || !draft.trim()}>Add tag</button></div>
    {error && <p className="issue-tag-error" role="alert">{error}</p>}
  </div>;
}
