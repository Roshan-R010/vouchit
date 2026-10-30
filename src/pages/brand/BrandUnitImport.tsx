import { Select } from "@/components/select";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "@/lib/api-fetch";
import { readApiResponse } from "@/lib/api-response";
import { ArrowLeft, Download, Upload } from "lucide-react";
import styles from "./brand-unit-import.module.css";

type Mapping = { unit: number; product: number | null; order: number | null };
type Source = { columns: string[]; rows: { rowNumber: number; cells: string[] }[]; warnings: string[] };
type Product = { id: string; name: string; sku: string | null };
type Row = { rowNumber: number; unitId: string; sourceProduct: string; productName: string; orderId: string; status: string; reason: string };
type Preview = { rows: Row[]; summary: { total: number; valid: number; existing: number; duplicate: number; errors: number }; warnings: string[]; unmatched: string[] };
const steps = ["Upload", "Map columns", "Match products", "Preview", "Import"];
const aliases = {
  unit: ["unitid", "unit", "serial", "serialnumber", "serialno", "deviceid", "devicecode", "productserial"],
  product: ["sku", "productsku", "model", "modelcode", "productname", "productid"],
  order: ["orderid", "ordernumber", "orderref", "orderreference", "purchaseorder"],
};
const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const suggest = (columns: string[], key: keyof typeof aliases) => {
  const matches = columns.flatMap((column, index) => aliases[key].includes(normalized(column)) ? [index] : []);
  return matches.length === 1 ? matches[0] : null;
};

export default function BrandUnitImport() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [step, setStep] = useState(0);
  const [filename, setFilename] = useState("");
  const [fileBase64, setFileBase64] = useState("");
  const [hasHeader, setHasHeader] = useState(true);
  const [source, setSource] = useState<Source | null>(null);
  const [mapping, setMapping] = useState<Mapping>({ unit: -1, product: null, order: null });
  const [mode, setMode] = useState<"single" | "multiple">("single");
  const [productId, setProductId] = useState("");
  const [productMap, setProductMap] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const options = { filename, fileBase64, hasHeader, mapping, mode, productId, productMap };
  const sourceValues = useMemo(() => mode === "multiple" && mapping.product !== null && source ? [...new Set(source.rows.map(row => row.cells[mapping.product!] ?? "").filter(Boolean))] : [], [source, mapping.product, mode]);
  const unmatched = sourceValues.filter(value => !products.some(product => product.sku === value) && !productMap[value]);
  const filtered = preview?.rows.filter(row => filter === "all" || (filter === "valid" ? row.status === "valid" : filter === "duplicates" ? ["existing", "duplicate"].includes(row.status) : row.status === "error")) ?? [];
  const pageRows = filtered.slice((page - 1) * 25, page * 25);

  useEffect(() => {
    if (!sessionId) return;
    apiFetch(`/api/demo/${sessionId}/brand/products`).then(readApiResponse).then(data => setProducts(data.products ?? [])).catch(() => {});
    apiFetch(`/api/demo/${sessionId}/brand/unit-import/history`).then(readApiResponse).then(data => setHistory(data.imports ?? [])).catch(() => {});
  }, [sessionId]);

  async function request(endpoint: string, body: unknown) {
    if (!sessionId) throw new Error("Open your brand workspace first.");
    return apiFetch(`/api/demo/${sessionId}/brand/unit-import/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(readApiResponse);
  }
  async function readFile(file: File) {
    setError(""); setSource(null); setPreview(null); setFilename(file.name); setFileBase64("");
    if (!/\.(csv|xlsx)$/i.test(file.name) || file.size > 8 * 1024 * 1024) { setError("Choose a CSV or XLSX file up to 8 MB."); return; }
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    setFileBase64(data);
  }
  async function parse() {
    setBusy(true); setError("");
    try {
      const parsed: Source = await request("parse", options);
      setSource(parsed);
      setMapping({ unit: suggest(parsed.columns, "unit") ?? -1, product: suggest(parsed.columns, "product"), order: suggest(parsed.columns, "order") });
      setStep(1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not read the file."); }
    finally { setBusy(false); }
  }
  async function showPreview() {
    setBusy(true); setError("");
    try { const data = await request("preview", options); setPreview(data); setPage(1); setStep(3); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not preview the import."); }
    finally { setBusy(false); }
  }
  async function commit() {
    if (busy || !preview?.summary.valid) return;
    setBusy(true); setError("");
    try { const data = await request("commit", options); setResult(data); setStep(4); setHistory(current => [data.history, ...current]); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not import units."); }
    finally { setBusy(false); }
  }
  const columns = source?.columns ?? [];
  const assigned = [mapping.unit, mode === "multiple" ? mapping.product : null, mapping.order].filter((value): value is number => value !== null);
  const mappingReady = mapping.unit >= 0 && (mode === "single" || mapping.product !== null) && new Set(assigned).size === assigned.length;
  const sample = "Unit ID,Product SKU,Order ID\nJB-0001,JB-400,ORD-1001\nJB-0002,JB-400,ORD-1002\n";

  return <div className={styles.page}>
    <Link className="business-back" to={`/demo/${sessionId}/brand/products`}><ArrowLeft size={16}/> Products</Link>
    <div className="business-page-header"><div><h1>Import units</h1><p>Add physical unit IDs to products already in your catalog.</p></div><a className="business-button" download="vouch-unit-import-sample.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(sample)}`}><Download size={16}/> Sample CSV</a></div>
    <ol className={styles.steps}>{steps.map((label, index) => <li key={label} className={index === step ? styles.current : index < step ? styles.done : ""}><span>{index + 1}</span>{label}</li>)}</ol>
    {error && <p className="business-notice error" role="alert">{error}</p>}
    {step === 0 && <section className="business-panel"><div className="business-panel-header"><div><h2>Upload a file</h2><p>CSV or XLSX, up to 8 MB and 5,000 unit rows. Nothing is saved until confirmation.</p></div></div><div className="business-form-section"><label className="business-field"><span>Choose a unit file</span><input type="file" accept=".csv,.xlsx" onChange={event => event.target.files?.[0] && readFile(event.target.files[0])}/></label><label className={styles.check}><input type="checkbox" checked={hasHeader} onChange={event => setHasHeader(event.target.checked)}/> First row contains column names</label>{filename && <p>{filename}</p>}<button className="business-button primary" type="button" disabled={!fileBase64 || busy} onClick={parse}><Upload size={16}/>{busy ? "Reading file…" : "Continue"}</button></div></section>}
    {step === 1 && source && <section className="business-panel"><div className="business-panel-header"><div><h2>Map columns</h2><p>Choose which columns hold the Unit ID, product and optional Order ID. Other columns are ignored.</p></div></div><div className="business-form-section"><div className={styles.fields}>
      {(["unit", "product", "order"] as const).map(key => <label key={key} className="business-field"><span>{key === "unit" ? "Unit ID *" : key === "product" ? "Product identifier (for multiple products)" : "Order ID (optional)"}</span><Select value={mapping[key] ?? ""} onChange={event => setMapping(current => ({ ...current, [key]: event.target.value === "" ? key === "unit" ? -1 : null : Number(event.target.value) }))}><option value="">{key === "unit" ? "Select column" : "Do not use"}</option>{columns.map((column, index) => <option value={index} key={index}>{column} — column {index + 1}</option>)}</Select></label>)}
    </div><p className={styles.muted}>Sample: {source.rows.slice(0, 3).map(row => row.cells.join(" · ")).join(" / ")}</p><div className={styles.actions}><button className="business-button" onClick={() => setStep(0)}>Back</button><button className="business-button primary" disabled={!mappingReady} onClick={() => setStep(2)}>Continue</button></div></div></section>}
    {step === 2 && <section className="business-panel"><div className="business-panel-header"><div><h2>Match products</h2><p>Every imported unit must belong to a product in this brand.</p></div></div><div className="business-form-section"><div className={styles.mode}><label><input type="radio" name="mode" checked={mode === "single"} onChange={() => setMode("single")}/> One product</label><label><input type="radio" name="mode" checked={mode === "multiple"} onChange={() => setMode("multiple")}/> Multiple products</label></div>
      {mode === "single" ? <label className="business-field"><span>Product *</span><Select value={productId} onChange={event => setProductId(event.target.value)}><option value="">Select product</option>{products.map(product => <option value={product.id} key={product.id}>{product.name}{product.sku ? ` (${product.sku})` : ""}</option>)}</Select></label> : <><p>Exact SKUs match automatically. Map any other value below; unmatched rows will be skipped.</p>{mapping.product === null ? <p className="business-notice error">Go back and map a product column.</p> : unmatched.length ? <div className={styles.matchGrid}>{unmatched.map(value => <label className="business-field" key={value}><span>{value}</span><Select value={productMap[value] ?? ""} onChange={event => setProductMap(current => ({ ...current, [value]: event.target.value }))}><option value="">Leave unmatched</option>{products.map(product => <option value={product.id} key={product.id}>{product.name}{product.sku ? ` (${product.sku})` : ""}</option>)}</Select></label>)}</div> : <p>All source identifiers match catalog SKUs or your mappings.</p>}</>}
      <div className={styles.actions}><button className="business-button" onClick={() => setStep(1)}>Back</button><button className="business-button primary" disabled={busy || !mappingReady || (mode === "single" && !productId)} onClick={showPreview}>{busy ? "Checking…" : "Preview rows"}</button></div></div></section>}
    {step === 3 && preview && <section className="business-panel"><div className="business-panel-header"><div><h2>Review import</h2><p>Only valid new rows will be inserted. Existing and invalid rows are skipped.</p></div></div><div className="business-form-section"><div className={styles.summary}><strong>{preview.summary.total} rows</strong><span>{preview.summary.valid} new</span><span>{preview.summary.existing} existing</span><span>{preview.summary.duplicate} repeated</span><span>{preview.summary.errors} invalid</span></div>{preview.warnings.length > 0 && <p className="business-notice">{preview.warnings[0]}{preview.warnings.length > 1 ? ` (+${preview.warnings.length - 1} more warnings)` : ""}</p>}<div className={styles.filters}>{["all", "valid", "duplicates", "errors"].map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(1); }}>{value}</button>)}</div><div className="business-table-wrap"><table className="business-table"><thead><tr><th>Row</th><th>Unit ID</th><th>Product</th><th>Order ID</th><th>Status</th></tr></thead><tbody>{pageRows.map(row => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td className="business-mono">{row.unitId || "—"}</td><td>{row.productName}</td><td className="business-mono">{row.orderId || "—"}</td><td>{row.status === "valid" ? "Ready" : row.reason}</td></tr>)}</tbody></table></div><div className={styles.pager}><span>{filtered.length} shown · page {page} of {Math.max(1, Math.ceil(filtered.length / 25))}</span><button className="business-button small" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><button className="business-button small" disabled={page * 25 >= filtered.length} onClick={() => setPage(page + 1)}>Next</button></div><p>Import <strong>{preview.summary.valid}</strong> new units; skip <strong>{preview.summary.total - preview.summary.valid}</strong> rows. Imported units do not create warranties. New Order IDs remain pending until their delivery record is confirmed.</p><div className={styles.actions}><button className="business-button" onClick={() => setStep(2)}>Back</button><button className="business-button primary" disabled={busy || preview.summary.valid === 0} onClick={commit}>{busy ? "Importing…" : `Import ${preview.summary.valid} units`}</button></div></div></section>}
    {step === 4 && result && <section className="business-panel"><div className="business-panel-header"><h2>Import complete</h2></div><div className="business-form-section"><p><strong>{result.insertedRows}</strong> units added; <strong>{result.skippedRows}</strong> rows skipped.</p><p>These units are now listed under their products. Warranty coverage starts only after a customer registers an eligible delivered unit.</p><Link className="business-button primary" to={`/demo/${sessionId}/brand/products`}>View products</Link></div></section>}
    {history.length > 0 && <section className="business-panel"><div className="business-panel-header"><h2>Recent imports</h2></div><div className="business-table-wrap"><table className="business-table"><thead><tr><th>File</th><th>Date</th><th>Result</th></tr></thead><tbody>{history.map(item => <tr key={item.id}><td>{item.filename}</td><td>{new Date(item.createdAt).toLocaleString()}</td><td>{item.insertedRows} added · {item.skippedRows} skipped</td></tr>)}</tbody></table></div></section>}
  </div>;
}
