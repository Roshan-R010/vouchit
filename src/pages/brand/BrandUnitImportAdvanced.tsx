import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, Upload } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";
import { FieldKey, FieldMapping, ImportType, importFields, importTypes, suggestField, validateMapping } from "@/lib/import-fields";
import { Select } from "@/components/select";
import { BrandUnitLifecycle } from "@/components/brand-unit-lifecycle";
import styles from "./brand-unit-import.module.css";

type Source = { columns: string[]; rows: { rowNumber: number; cells: string[] }[]; warnings: string[] };
type FileState = { id: string; filename: string; fileBase64: string; size: number; hasHeader: boolean; importType: ImportType; mapping: FieldMapping; mode: "single" | "multiple"; productId: string; productMap: Record<string, string>; statusMap: Record<string, "PENDING" | "DELIVERED" | "RETURNED" | "FOR_SALE_AGAIN" | "IGNORE">; profileId?: string; source?: Source; warning?: string };
type Profile = { id: string; name: string; importType: ImportType; config: any; lastUsedAt: string | null; version: number };
type PlanRow = { filename: string; rowNumber: number; unitId: string; orderId: string; status: string; reason: string; existing: string; incoming: string; actions: string[] };
type Plan = { rows: PlanRow[]; summary: { total: number; new: number; updates: number; returns: number; resales: number; unchanged: number; ambiguous: number; duplicate: number; errors: number }; previewToken: string };
const steps = ["Upload files", "Map columns", "Match products", "Preview changes", "Confirm import"];
const sample = "Unit ID,Order ID,Product SKU,Confirmed Delivery Date\nJB001,ORD1001,JB-400,2026-10-10\n";
function csvCell(value: unknown) { const text = String(value ?? ""); const safe = /^[=+@-]/.test(text) ? `'${text}` : text; return `"${safe.replaceAll('"', '""')}"`; }
function downloadErrors(rows: PlanRow[]) { const lines = [["File", "Row", "Unit ID", "Order ID", "Status", "Reason"], ...rows.filter(row => ["error", "ambiguous", "duplicate"].includes(row.status)).map(row => [row.filename, row.rowNumber, row.unitId, row.orderId, row.status, row.reason])]; const blob = new Blob([lines.map(line => line.map(csvCell).join(",")).join("\r\n")], { type: "text/csv" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "vouch-import-errors.csv"; link.click(); URL.revokeObjectURL(url); }

export default function BrandUnitImportAdvanced() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<FileState[]>([]);
  const [activeFile, setActiveFile] = useState(0);
  const [products, setProducts] = useState<{ id: string; name: string; sku: string | null }[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [profileName, setProfileName] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [result, setResult] = useState<any>(null);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [confirmReturns, setConfirmReturns] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unitSearch, setUnitSearch] = useState("");
  const [unitResults, setUnitResults] = useState<any[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const preferredProfileId = useRef<string | undefined>(undefined);
  const file = files[activeFile];
  const setFile = (index: number, change: Partial<FileState>) => setFiles(current => current.map((item, at) => at === index ? { ...item, ...change } : item));
  const selectedRows = useMemo(() => plan?.rows.filter(row => filter === "all" || row.status === filter) ?? [], [plan, filter]);
  const pageRows = selectedRows.slice((page - 1) * 25, page * 25);

  useEffect(() => {
    if (!sessionId) return;
    apiFetch(`/api/demo/${sessionId}/brand/products`).then(readApiResponse).then(data => setProducts(data.products ?? [])).catch(() => {});
    refreshLists();
  }, [sessionId]);
  async function refreshLists() {
    if (!sessionId) return;
    const [p, h] = await Promise.all([
      apiFetch(`/api/demo/${sessionId}/brand/unit-import/profiles`).then(readApiResponse).catch(() => ({ profiles: [] })),
      apiFetch(`/api/demo/${sessionId}/brand/unit-import/history`).then(readApiResponse).catch(() => ({ imports: [] })),
    ]);
    setProfiles(p.profiles ?? []); setHistory(h.imports ?? []);
  }
  async function post(path: string, body: unknown, method = "POST") {
    if (!sessionId) throw new Error("Open your brand workspace first.");
    return apiFetch(`/api/demo/${sessionId}/brand/unit-import/${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(readApiResponse);
  }
  async function addFiles(input: FileList | null) {
    if (!input) return;
    setError("");
    if (files.length + input.length > 5) { setError("Upload at most five files in one import."); return; }
    const additions: FileState[] = [];
    for (const raw of Array.from(input)) {
      if (!/\.(csv|xlsx)$/i.test(raw.name) || !raw.size || raw.size > 8 * 1024 * 1024) { setError(`${raw.name}: choose a non-empty CSV or XLSX file up to 8 MB.`); return; }
      const fileBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(raw); });
      const profile = profiles.find(item => item.id === preferredProfileId.current);
      additions.push({ id: crypto.randomUUID(), filename: raw.name, fileBase64, size: raw.size, hasHeader: true, importType: profile?.importType ?? "UNIT_REGISTRY", mapping: {}, mode: "single", productId: "", productMap: {}, statusMap: {}, profileId: profile?.id });
    }
    preferredProfileId.current = undefined;
    setFiles(current => [...current, ...additions]);
  }
  async function parseFiles() {
    setBusy(true); setError("");
    try {
      const parsed = await Promise.all(files.map(async item => {
        const source: Source = await post("parse", { filename: item.filename, fileBase64: item.fileBase64, hasHeader: item.hasHeader });
        const profile = profiles.find(p => p.id === item.profileId);
        const matchesProfile = !!profile && JSON.stringify(profile.config.columns) === JSON.stringify(source.columns);
        const mapping: FieldMapping = matchesProfile ? profile!.config.mapping : Object.fromEntries(source.columns.map((column, index) => [suggestField(column), index]).filter(([key]) => !!key));
        return { ...item, source, mapping, importType: matchesProfile ? profile!.importType : item.importType, mode: matchesProfile ? profile!.config.mode : item.mode, productId: matchesProfile ? profile!.config.productId ?? "" : item.productId, productMap: matchesProfile ? profile!.config.productMap ?? {} : item.productMap, statusMap: matchesProfile ? profile!.config.statusMap ?? {} : item.statusMap, warning: profile && !matchesProfile ? `Columns changed since “${profile.name}” was saved. Review every mapping before importing.` : "" };
      }));
      setFiles(parsed); setActiveFile(0); setStep(1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not read the files."); }
    finally { setBusy(false); }
  }
  function updateMapping(index: number, sourceIndex: number, key: FieldKey | "") {
    const next = { ...files[index].mapping };
    const previousIndex = key ? next[key] : undefined;
    for (const field of importFields) if (next[field.key] === sourceIndex) delete next[field.key];
    if (key) next[key] = sourceIndex;
    setError(key && previousIndex !== undefined && previousIndex !== sourceIndex ? `${importFields.find(field => field.key === key)?.label} was moved from another source column. Review the mapping before continuing.` : "");
    setFile(index, { mapping: next });
  }
  function checkMappings() {
    try { files.forEach(item => validateMapping(item.mapping, item.source!.columns.length, item.importType)); setError(""); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Check the mappings."); return false; }
  }
  async function saveProfile() {
    if (!file?.source || !profileName.trim() || !checkMappings()) return;
    setBusy(true); setError("");
    try {
      const config = { columns: file.source.columns, mapping: file.mapping, importType: file.importType, mode: file.mode, productId: file.productId, productMap: file.productMap, statusMap: file.statusMap };
      const response = file.profileId ? await post(`profiles/${file.profileId}`, { name: profileName, config }, "PUT") : await post("profiles", { name: profileName, config });
      setFile(activeFile, { profileId: response.profile.id }); setProfileName(""); await refreshLists();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save profile."); }
    finally { setBusy(false); }
  }
  async function removeProfile(profile: Profile) {
    if (!window.confirm(`Delete the “${profile.name}” profile? Previously imported units and history will remain.`)) return;
    try { await apiFetch(`/api/demo/${sessionId}/brand/unit-import/profiles/${profile.id}`, { method: "DELETE" }).then(readApiResponse); setFiles(current => current.map(item => item.profileId === profile.id ? { ...item, profileId: undefined } : item)); await refreshLists(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete profile."); }
  }
  async function searchUnits() {
    if (!sessionId || unitSearch.trim().length < 2) { setUnitResults([]); return; }
    try { const data = await apiFetch(`/api/demo/${sessionId}/brand/units/search?q=${encodeURIComponent(unitSearch.trim())}`).then(readApiResponse); setUnitResults(data.units ?? []); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not search units."); }
  }
  async function preview() {
    if (!checkMappings()) return;
    setBusy(true); setError("");
    try { const data = await post("batch/preview", { files: files.map(({ source, warning, size, id, ...rest }) => rest) }); setPlan(data); setPage(1); setFilter("all"); setConfirmReturns(false); setStep(3); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not preview the import."); }
    finally { setBusy(false); }
  }
  async function commit() {
    if (!plan || busy || (plan.summary.returns > 0 && !confirmReturns)) return;
    setBusy(true); setError("");
    try { const data = await post("batch/commit", { files: files.map(({ source, warning, size, id, ...rest }) => rest), previewToken: plan.previewToken, confirmReturns }); setResult(data); setStep(4); await refreshLists(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not complete the import."); }
    finally { setBusy(false); }
  }
  const statusValues = file?.source ? [...new Set(file.source.rows.flatMap(row => [file.mapping.deliveryStatus === undefined ? "" : row.cells[file.mapping.deliveryStatus], file.mapping.returnStatus === undefined ? "" : row.cells[file.mapping.returnStatus]]).filter(Boolean))] : [];
  const productValues = file?.source && file.mapping.product !== undefined ? [...new Set(file.source.rows.map(row => row.cells[file.mapping.product!]).filter(Boolean))] : file?.source && file.mapping.sku !== undefined ? [...new Set(file.source.rows.map(row => row.cells[file.mapping.sku!]).filter(Boolean))] : [];

  return <div className={styles.page}>
    <Link className="business-back" to={`/demo/${sessionId}/brand/products`}><ArrowLeft size={16}/> Products</Link>
    <div className="business-page-header"><div><h1>Import Units</h1><p>Import and update product units using your existing business files.</p></div><a className="business-button" download="vouch-unit-import-sample.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(sample)}`}><Download size={16}/> Download Sample</a></div>
    <ol className={styles.steps}>{steps.map((label, index) => <li key={label} className={index === step ? styles.current : index < step ? styles.done : ""}><span>{index + 1}</span>{label}</li>)}</ol>
    {error && <p className="business-notice error" role="alert">{error}</p>}
    {step === 0 && <>
      <section className="business-panel"><div className="business-panel-header"><div><h2>Upload files</h2><p>CSV or XLSX, up to 8 MB and 5,000 rows per file. Add unit, delivery, and completed return files together or separately.</p></div></div><div className="business-form-section">
        <label className="business-field"><span>Choose files</span><input ref={fileInputRef} type="file" accept=".csv,.xlsx" multiple onChange={event => { addFiles(event.target.files); event.target.value = ""; }}/></label>
        {files.map((item, index) => <div key={item.id} style={{ padding: "12px 0", borderBottom: "1px solid #e5e5e5", display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}><div><strong>{item.filename}</strong><p>{(item.size / 1024).toFixed(0)} KB</p></div><label className="business-field"><span>Import type</span><Select value={item.importType} onChange={event => setFile(index, { importType: event.target.value as ImportType })}>{importTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</Select></label><label className="business-field"><span>Saved profile</span><Select value={item.profileId ?? ""} onChange={event => setFile(index, { profileId: event.target.value || undefined })}><option value="">New configuration</option>{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</Select></label><label className={styles.check}><input type="checkbox" checked={item.hasHeader} onChange={event => setFile(index, { hasHeader: event.target.checked })}/> First row has headings</label><button type="button" className="business-button small" onClick={() => setFiles(current => current.filter(row => row.id !== item.id))}>Remove</button></div>)}
        <div className={styles.actions}><button type="button" className="business-button primary" disabled={!files.length || busy} onClick={parseFiles}><Upload size={16}/>{busy ? "Reading…" : "Continue"}</button></div>
      </div></section>
      <section className="business-panel"><div className="business-panel-header"><h2>Saved Import Profiles</h2></div><div className="business-form-section">{profiles.length ? profiles.map(profile => <div key={profile.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", alignItems: "center" }}><span>{profile.name} · {importTypes.find(type => type.value === profile.importType)?.label} · {profile.lastUsedAt ? `Last used ${new Date(profile.lastUsedAt).toLocaleDateString()}` : "Never used"}</span><span style={{ display: "flex", gap: 8 }}><button className="business-button small" type="button" onClick={() => { preferredProfileId.current = profile.id; fileInputRef.current?.click(); }}>Use profile</button><button className="business-button small" type="button" onClick={() => removeProfile(profile)}>Delete</button></span></div>) : <p>No saved profiles yet. Save a mapping during your first import.</p>}</div></section>
      <section className="business-panel"><div className="business-panel-header"><div><h2>Find a unit</h2><p>Search by stamped Unit ID to review status and lifecycle history.</p></div></div><div className="business-form-section"><form onSubmit={event => { event.preventDefault(); searchUnits(); }} style={{ display: "flex", alignItems: "end", gap: 10, flexWrap: "wrap" }}><label className="business-field"><span>Unit ID</span><input type="search" value={unitSearch} onChange={event => setUnitSearch(event.target.value)} placeholder="Enter at least two characters"/></label><button className="business-button" type="submit">Search</button></form>{unitResults.length > 0 && <div className="business-table-wrap"><table className="business-table"><thead><tr><th>Unit ID</th><th>Product</th><th>Current order</th><th>Status</th><th></th></tr></thead><tbody>{unitResults.map(unit => <tr key={unit.id}><td className="business-mono">{unit.serialNumber}</td><td>{unit.productModel.name}</td><td>{unit.purchaseOrder?.orderNumber ?? "—"}</td><td>{unit.status.replaceAll("_", " ")}</td><td><button type="button" className="business-button small" onClick={() => setSelectedUnitId(unit.id)}>Details</button></td></tr>)}</tbody></table></div>}</div></section>
      {selectedUnitId && sessionId && <BrandUnitLifecycle key={selectedUnitId} sessionId={sessionId} unitId={selectedUnitId} onChanged={searchUnits} onClose={() => setSelectedUnitId(null)}/>}
    </>}
    {step === 1 && file?.source && <section className="business-panel"><div className="business-panel-header"><div><h2>Map columns</h2><p>Choose a Vouch field for each source column. Suggestions can be changed. Unneeded columns can be skipped.</p></div></div><div className="business-form-section">
      <div className={styles.filters}>{files.map((item, index) => <button type="button" key={item.id} aria-pressed={activeFile === index} onClick={() => { setActiveFile(index); setProfileName(""); }}>{item.filename}</button>)}</div>
      {file.warning && <p className="business-notice">{file.warning}</p>}
      <p>{file.source.rows.length} rows · {file.source.columns.length} detected columns{file.source.warnings.length ? ` · ${file.source.warnings[0]}` : ""}</p>
      <label className="business-field"><span>Import type</span><Select value={file.importType} onChange={event => setFile(activeFile, { importType: event.target.value as ImportType })}>{importTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</Select></label>
      <div className="business-table-wrap"><table className="business-table"><thead><tr><th>Uploaded column</th><th>Sample</th><th>Vouch field</th></tr></thead><tbody>{file.source.columns.map((column, index) => <tr key={index}><td>{column}</td><td>{file.source?.rows.find(row => row.cells[index])?.cells[index] ?? "—"}</td><td><Select aria-label={`Map ${column}`} value={importFields.find(field => file.mapping[field.key] === index)?.key ?? ""} onChange={event => updateMapping(activeFile, index, event.target.value as FieldKey | "")}><option value="">Skip column</option>{importFields.filter(field => field.importTypes.includes(file.importType)).map(field => <option key={field.key} value={field.key}>{field.label}</option>)}</Select></td></tr>)}</tbody></table></div>
      <p>Required: {file.importType === "UNIT_REGISTRY" ? "Unit ID and Order ID" : file.importType === "COMBINED" ? "Unit ID" : "Unit ID or an unambiguous Order ID"}.</p>
      {statusValues.length > 0 && <><h3>Status value mapping</h3>{statusValues.map(value => <label className="business-field" key={value}><span>{value}</span><Select value={file.statusMap[value] ?? ""} onChange={event => setFile(activeFile, { statusMap: { ...file.statusMap, [value]: event.target.value as any } })}><option value="">Use recognized meaning</option><option value="PENDING">Pending</option><option value="DELIVERED">Delivered</option><option value="RETURNED">Returned (completed)</option><option value="FOR_SALE_AGAIN">For Sale Again</option><option value="IGNORE">Ignore</option></Select></label>)}</>}
      <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}><label className="business-field"><span>{file.profileId ? "Rename or update profile" : "Save as profile"}</span><input value={profileName} onChange={event => setProfileName(event.target.value)} placeholder={profiles.find(profile => profile.id === file.profileId)?.name ?? "e.g. Delivery export"}/></label><button className="business-button" type="button" disabled={busy || !profileName.trim()} onClick={saveProfile}>{file.profileId ? "Update profile" : "Save profile"}</button></div>
      <div className={styles.actions}><button className="business-button" onClick={() => setStep(0)}>Back</button><button className="business-button primary" onClick={() => checkMappings() && setStep(2)}>Continue</button></div>
    </div></section>}
    {step === 2 && <section className="business-panel"><div className="business-panel-header"><div><h2>Match records and products</h2><p>Unit ID is the safest match. Order ID alone updates only one matching unit; multiple matches are flagged in the preview.</p></div></div><div className="business-form-section"><div className={styles.filters}>{files.map((item, index) => <button type="button" key={item.id} aria-pressed={activeFile === index} onClick={() => setActiveFile(index)}>{item.filename}</button>)}</div>
      {file && (file.importType === "UNIT_REGISTRY" || file.importType === "COMBINED") && <><div className={styles.mode}><label><input type="radio" name="mode" checked={file.mode === "single"} onChange={() => setFile(activeFile, { mode: "single" })}/> One product</label><label><input type="radio" name="mode" checked={file.mode === "multiple"} onChange={() => setFile(activeFile, { mode: "multiple" })}/> Multiple products</label></div>{file.mode === "single" ? <label className="business-field"><span>Product</span><Select value={file.productId} onChange={event => setFile(activeFile, { productId: event.target.value })}><option value="">Select product</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}{product.sku ? ` (${product.sku})` : ""}</option>)}</Select></label> : <>{productValues.map(value => <label className="business-field" key={value}><span>{value}</span><Select value={file.productMap[value] ?? ""} onChange={event => setFile(activeFile, { productMap: { ...file.productMap, [value]: event.target.value } })}><option value="">Use exact SKU or leave unmatched</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</Select></label>)}</>}</>}
      {file && <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}><label className="business-field"><span>Save configuration as profile</span><input value={profileName} onChange={event => setProfileName(event.target.value)} placeholder={profiles.find(profile => profile.id === file.profileId)?.name ?? "Profile name"}/></label><button type="button" className="business-button" disabled={busy || !profileName.trim()} onClick={saveProfile}>{file.profileId ? "Update profile" : "Save profile"}</button></div>}
      <div className={styles.actions}><button className="business-button" onClick={() => setStep(1)}>Back</button><button className="business-button primary" disabled={busy} onClick={preview}>{busy ? "Checking…" : "Preview changes"}</button></div>
    </div></section>}
    {step === 3 && plan && <section className="business-panel"><div className="business-panel-header"><div><h2>Preview changes</h2><p>Review proposed operations and resolve errors before confirming.</p></div></div><div className="business-form-section"><div className={styles.summary}><strong>{plan.summary.total} rows</strong><span>{plan.summary.new} new</span><span>{plan.summary.updates} updates</span><span>{plan.summary.returns} returns</span><span>{plan.summary.resales} resales</span><span>{plan.summary.unchanged} unchanged</span><span>{plan.summary.ambiguous} ambiguous</span><span>{plan.summary.errors} errors</span></div>
      <div className={styles.filters}>{["all", "new", "update", "return", "unchanged", "ambiguous", "duplicate", "error"].map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(1); }}>{value}</button>)}</div>
      <div className="business-table-wrap"><table className="business-table"><thead><tr><th>File / row</th><th>Unit ID</th><th>Order ID</th><th>Current</th><th>Incoming</th><th>Action / validation</th></tr></thead><tbody>{pageRows.map(row => <tr key={`${row.filename}:${row.rowNumber}`}><td>{row.filename} / {row.rowNumber}</td><td className="business-mono">{row.unitId || "—"}</td><td className="business-mono">{row.orderId || "—"}</td><td>{row.existing || "—"}</td><td>{row.incoming || "—"}</td><td>{row.reason || row.actions.join(", ") || "Unchanged"}</td></tr>)}</tbody></table></div>
      <div className={styles.pager}><span>{selectedRows.length} shown · page {page} of {Math.max(1, Math.ceil(selectedRows.length / 25))}</span><button className="business-button small" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><button className="business-button small" disabled={page * 25 >= selectedRows.length} onClick={() => setPage(page + 1)}>Next</button></div>
      {(plan.summary.errors || plan.summary.ambiguous || plan.summary.duplicate) > 0 && <button className="business-button" type="button" onClick={() => downloadErrors(plan.rows)}><Download size={16}/> Download error report</button>}
      {plan.summary.returns > 0 && <label className={styles.check}><input type="checkbox" checked={confirmReturns} onChange={event => setConfirmReturns(event.target.checked)}/> This import will deactivate {plan.summary.returns} customer {plan.summary.returns === 1 ? "warranty" : "warranties"} because the units are marked returned. I confirm these returns are completed.</label>}
      <div className={styles.actions}><button className="business-button" onClick={() => setStep(2)}>Back</button><button className="business-button primary" disabled={busy || (!plan.summary.new && !plan.summary.updates && !plan.summary.returns && !plan.summary.resales) || (plan.summary.returns > 0 && !confirmReturns)} onClick={commit}>{busy ? "Importing…" : "Confirm Import"}</button></div>
    </div></section>}
    {step === 4 && result && <section className="business-panel"><div className="business-panel-header"><h2>Import complete</h2></div><div className="business-form-section"><p>{result.summary.new} units added · {result.summary.updates} updated · {result.summary.returns} returns processed · {result.history.skippedRows} skipped.</p>{result.history.failedRows > 0 && <button className="business-button" onClick={() => downloadErrors(result.rows)}>Download error report</button>}<button className="business-button primary" onClick={() => { setStep(0); setFiles([]); setPlan(null); setResult(null); }}>Import more files</button></div></section>}
    <section className="business-panel"><div className="business-panel-header"><h2>Recent imports</h2></div>{history.length ? <div className="business-table-wrap"><table className="business-table"><thead><tr><th>File</th><th>Type / profile</th><th>Date</th><th>Result</th><th>Status</th></tr></thead><tbody>{history.map(item => <tr key={item.id}><td>{item.filename}</td><td>{item.importType || "Unit registry"}{item.profileName ? ` · ${item.profileName}` : ""}</td><td>{new Date(item.createdAt).toLocaleString()}</td><td>{item.insertedRows} added · {item.updatedRows ?? 0} updated · {item.returnedRows ?? 0} returned · {item.skippedRows} skipped · {item.failedRows} errors</td><td>{item.status}</td></tr>)}</tbody></table></div> : <div className="business-form-section"><p>No previous imports.</p></div>}</section>
  </div>;
}
