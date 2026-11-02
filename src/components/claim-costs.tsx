import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";
import styles from "./claim-costs.module.css";

type Cost = { id: string; category: string; label: string | null; note: string | null; amountPaise: number; version: number };
type Draft = { key: string; id?: string; version?: number; label: string; amount: string };
const categoryNames: Record<string, string> = {
  REPAIR_LABOR: "Repair labor", REPLACEMENT_PRODUCT: "Replacement product", PARTS_MATERIALS: "Parts/materials",
  RETURN_SHIPPING: "Return shipping", OUTBOUND_SHIPPING: "Outbound shipping", REFUND_PAID: "Refund paid", OTHER: "Other",
};
const nameOf = (cost: Cost) => cost.label || categoryNames[cost.category] || "Expense";
const amountOf = (paise: number) => `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;
const toDraft = (cost: Cost): Draft => ({ key: cost.id, id: cost.id, version: cost.version, label: nameOf(cost), amount: amountOf(cost.amountPaise) });
function parseDraftAmount(value: string): bigint | null {
  if (!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [rupees, paise = ""] = value.trim().split(".");
  return BigInt(rupees) * 100n + BigInt(paise.padEnd(2, "0") || "0");
}
export function formatCost(paise: bigint) {
  return `₹${new Intl.NumberFormat("en-IN").format(paise / 100n)}.${(paise % 100n).toString().padStart(2, "0")}`;
}

export function useClaimCosts(sessionId: string, claimId: string) {
  const endpoint = `/api/demo/${sessionId}/brand/claims/${claimId}/costs`;
  const [saved, setSaved] = useState<Cost[]>([]);
  const [rows, setRows] = useState<Draft[]>([]);
  const [savedTotal, setSavedTotal] = useState("0");
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const applySnapshot = (data: any, resetDraft: boolean) => {
    if (!Array.isArray(data?.costs) || typeof data?.totalPaise !== "string") throw new Error("Could not read saved costs.");
    setSaved(data.costs); setSavedTotal(data.totalPaise);
    setLoadFailed(false);
    if (resetDraft) setRows(data.costs.map(toDraft));
  };
  const load = useCallback(async (resetDraft: boolean) => {
    const data = await apiFetch(endpoint, { cache: "no-store" }).then(readApiResponse);
    applySnapshot(data, resetDraft);
  }, [endpoint]);
  useEffect(() => {
    if (!sessionId || !claimId) return;
    setExpanded(false); setLoading(true); setLoadFailed(false); setSaved([]); setRows([]); setSavedTotal("0"); setConflict(false); setError(""); setNotice("");
    let active = true;
    apiFetch(endpoint, { cache: "no-store" }).then(readApiResponse).then(data => { if (active) applySnapshot(data, true); })
      .catch(cause => { if (active) { setLoadFailed(true); setError(cause instanceof Error ? cause.message : "Could not load costs."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [endpoint, sessionId, claimId]);

  const savedById = new Map(saved.map(cost => [cost.id, cost]));
  const dirty = rows.length !== saved.length || rows.some(row => {
    const original = row.id ? savedById.get(row.id) : undefined;
    const parsed = parseDraftAmount(row.amount);
    return !original || row.label.trim() !== nameOf(original) || parsed !== BigInt(original.amountPaise);
  });
  const parsed = rows.map(row => parseDraftAmount(row.amount));
  const valid = rows.every((row, index) => row.label.trim().length > 0 && row.label.trim().length <= 120 && parsed[index] !== null);
  const draftTotal = parsed.every(value => value !== null) ? parsed.reduce<bigint>((sum, value) => sum + value!, 0n) : null;

  function updateRow(key: string, changes: Partial<Draft>) {
    setRows(current => current.map(row => row.key === key ? { ...row, ...changes } : row));
    setError(""); setNotice("");
  }
  function removeRow(row: Draft) {
    if (busy) return;
    if (row.id && !window.confirm(`Remove “${row.label || "this expense"}” when you save changes?`)) return;
    setRows(current => current.filter(item => item.key !== row.key));
    setError(""); setNotice("");
  }
  function addRow() {
    setRows(current => [...current, { key: crypto.randomUUID(), label: "", amount: "" }]);
    setExpanded(true); setError(""); setNotice("");
  }
  async function save() {
    if (busy || !dirty || conflict) return;
    if (!valid) { setError("Enter a name and a valid INR amount with up to two decimal places for every expense."); return; }
    const upserts = rows.filter(row => {
      const original = row.id ? savedById.get(row.id) : undefined;
      return !original || row.label.trim() !== nameOf(original) || parseDraftAmount(row.amount) !== BigInt(original.amountPaise);
    }).map(row => row.id ? { id: row.id, version: row.version, label: row.label.trim(), amount: row.amount.trim(), currency: "INR" }
      : { newId: row.key, label: row.label.trim(), amount: row.amount.trim(), currency: "INR" });
    const deletes = saved.filter(cost => !rows.some(row => row.id === cost.id)).map(cost => ({ id: cost.id, version: cost.version }));
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await apiFetch(`${endpoint}/batch`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ upserts, deletes }) });
      if (response.status === 409 || response.status === 404) {
        setConflict(true);
        try { await load(false); } catch { setLoadFailed(true); }
        throw new Error("Costs changed elsewhere. Your draft is still here; reload saved costs before editing again.");
      }
      applySnapshot(await readApiResponse(response), true);
      setNotice("Cost changes saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save costs. No changes were saved."); }
    finally { setBusy(false); }
  }
  function discard() {
    if (dirty && !window.confirm("Discard your unsaved cost changes?")) return;
    setRows(saved.map(toDraft)); setConflict(false); setError(""); setNotice("");
  }
  async function reloadSaved() {
    if (dirty && !window.confirm("Discard your draft and load the latest saved costs?")) return;
    setBusy(true); setError("");
    try { await load(true); setConflict(false); setNotice(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not reload costs."); }
    finally { setBusy(false); }
  }
  return { saved, rows, savedTotal, expanded, setExpanded, loading, loadFailed, busy, conflict, error, notice, dirty, draftTotal, addRow, updateRow, removeRow, save, discard, reloadSaved };
}

export type ClaimCostsEditor = ReturnType<typeof useClaimCosts>;

export function ClaimCosts({ editor }: { editor: ClaimCostsEditor }) {
  const { saved, rows, savedTotal, expanded, setExpanded, loading, loadFailed, busy, conflict, error, notice, dirty, draftTotal, addRow, updateRow, removeRow, save, discard, reloadSaved } = editor;
  return <section className={`business-panel ${styles.card}`} aria-label="Resolution costs">
    <h2 className={styles.heading}><button type="button" className={styles.toggle} aria-expanded={expanded} aria-controls="claim-costs-body" onClick={() => setExpanded(!expanded)}>
      <span><strong>Resolution Costs</strong><small>Record actual expenses incurred for this claim.</small></span>
      <span className={styles.headerRight}>{dirty && <em>Unsaved changes</em>}<strong>{loading ? "Loading…" : loadFailed ? "Unavailable" : formatCost(BigInt(savedTotal))}</strong><ChevronDown size={19} className={expanded ? styles.chevronOpen : styles.chevron}/></span>
    </button></h2>
    {expanded && <div id="claim-costs-body" className={styles.body}>
      {loading ? <p>Loading costs…</p> : loadFailed && !conflict ? <><p className={styles.error} role="alert">{error}</p><button type="button" className="business-button" onClick={() => void reloadSaved()}>Try again</button></> : <>
        {!rows.length && <p className={styles.empty}>{saved.length ? "All saved expenses are marked for removal." : "No costs recorded. Add an expense to begin."}</p>}
        {!!rows.length && <div className={styles.columnHeads}><span>Expense</span><span>Amount (INR)</span><span className={styles.srOnly}>Remove</span></div>}
        <div className={styles.rows}>{rows.map((row, index) => <div className={styles.row} key={row.key}>
          <label className={styles.expenseField}><span className={styles.mobileLabel}>Expense</span><input aria-label={`Expense ${index + 1} name`} maxLength={120} placeholder="e.g. Repair labor" value={row.label} disabled={busy || conflict} onChange={event => updateRow(row.key, { label: event.target.value })}/></label>
          <label className={styles.amountField}><span className={styles.mobileLabel}>Amount (INR)</span><input aria-label={`Expense ${index + 1} amount (INR)`} inputMode="decimal" placeholder="0.00" value={row.amount} disabled={busy || conflict} onChange={event => updateRow(row.key, { amount: event.target.value })}/></label>
          <button type="button" className={styles.remove} aria-label={`Remove expense ${index + 1}`} title="Remove expense" disabled={busy || conflict} onClick={() => removeRow(row)}><Trash2 size={17}/></button>
          {row.id && saved.find(cost => cost.id === row.id)?.note && <small className={styles.legacyNote}>Previous note: {saved.find(cost => cost.id === row.id)?.note}</small>}
        </div>)}</div>
        <button type="button" className={styles.add} onClick={addRow} disabled={busy || conflict}><Plus size={16}/> Add another expense</button>
        <div className={styles.total}><span>Total Resolution Cost <small>{dirty ? "Draft" : "Saved"}</small></span><strong>{draftTotal === null ? "Check amounts" : formatCost(draftTotal)}</strong></div>
        <div className={styles.actions}><button type="button" className="business-button primary" disabled={busy || !dirty || conflict} onClick={() => void save()}>{busy ? "Saving…" : "Save changes"}</button>{dirty && <button type="button" className="business-button" disabled={busy} onClick={conflict ? () => void reloadSaved() : discard}>{conflict ? "Reload saved costs" : "Discard changes"}</button>}</div>
        {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
      </>}
    </div>}
  </section>;
}
