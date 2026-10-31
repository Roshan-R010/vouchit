import readXlsxFile from "read-excel-file/node";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";

export const IMPORT_MAX_BYTES = 8 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 5000;
export const IMPORT_MAX_COLUMNS = 30;

export type ImportMapping = { unit: number; product?: number | null; order?: number | null };
export type ImportOptions = {
  filename: string;
  fileBase64: string;
  hasHeader: boolean;
  mapping: ImportMapping;
  mode: "single" | "multiple";
  productId?: string;
  productMap?: Record<string, string>;
};
type Source = { columns: string[]; rows: { rowNumber: number; cells: string[] }[]; warnings: string[] };
type Product = { id: string; name: string; sku: string | null };
export type PreviewRow = { rowNumber: number; unitId: string; sourceProduct: string; productId: string | null; productName: string; orderId: string; status: "valid" | "existing" | "duplicate" | "error"; reason: string };

function csvDelimiter(text: string) {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const scores = [",", "\t", ";"].map(delimiter => [delimiter, first.split(delimiter).length] as const);
  return scores.sort((a, b) => b[1] - a[1])[0][0];
}

export function parseCsv(text: string): string[][] {
  const delimiter = csvDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || !cell) quoted = !quoted;
      else throw new Error("CSV has a misplaced quote.");
    } else if (!quoted && char === delimiter) { row.push(cell); cell = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("CSV has an unclosed quoted value.");
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function fileBytes(options: ImportOptions): Buffer {
  if (typeof options.filename !== "string" || !/\.(csv|xlsx)$/i.test(options.filename)) throw new Error("Choose a CSV or XLSX file.");
  if (typeof options.fileBase64 !== "string" || options.fileBase64.length > IMPORT_MAX_BYTES * 1.4 + 100) throw new Error("File must be 8 MB or smaller.");
  const base64 = options.fileBase64.replace(/^data:[^,]+,/, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new Error("File data is invalid.");
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > IMPORT_MAX_BYTES) throw new Error("File must be 8 MB or smaller.");
  return bytes;
}

export async function parseSource(options: ImportOptions): Promise<Source> {
  const bytes = fileBytes(options);
  let table: string[][];
  const warnings: string[] = [];
  if (/\.xlsx$/i.test(options.filename)) {
    if (bytes.subarray(0, 2).toString() !== "PK") throw new Error("This XLSX file is invalid.");
    let cells: (string | number | boolean | Date | null)[][];
    try { cells = await readXlsxFile(bytes) as typeof cells; }
    catch { throw new Error("This XLSX file could not be read. Check that it is a valid workbook."); }
    table = cells.map((row, rowIndex) => row.map((cell, colIndex) => {
      if (typeof cell === "number") {
        if (!Number.isSafeInteger(cell) || String(cell).includes("e")) warnings.push(`Row ${rowIndex + 1}, column ${colIndex + 1}: numeric spreadsheet cell may have lost identifier digits. Format IDs as text before export.`);
        else warnings.push(`Row ${rowIndex + 1}, column ${colIndex + 1}: numeric cell may have lost leading zeros.`);
      }
      return cell == null ? "" : cell instanceof Date ? cell.toISOString() : String(cell);
    }));
  } else {
    const decoder = bytes[0] === 0xff && bytes[1] === 0xfe ? new TextDecoder("utf-16le", { fatal: true }) : new TextDecoder("utf-8", { fatal: true });
    try { table = parseCsv(decoder.decode(bytes).replace(/^\uFEFF/, "")); }
    catch { throw new Error("This CSV file could not be read. Save it as UTF-8 or UTF-16 text."); }
  }
  if (!table.length) throw new Error("The file is empty.");
  const columnsCount = Math.max(...table.map(row => row.length));
  if (columnsCount > IMPORT_MAX_COLUMNS) throw new Error(`Use at most ${IMPORT_MAX_COLUMNS} columns.`);
  const columns = options.hasHeader ? Array.from({ length: columnsCount }, (_, i) => table[0][i]?.trim() || `Column ${i + 1}`) : Array.from({ length: columnsCount }, (_, i) => `Column ${i + 1}`);
  const rows = table.slice(options.hasHeader ? 1 : 0).map((cells, index) => ({ rowNumber: index + (options.hasHeader ? 2 : 1), cells: cells.map(cell => cell.trim()) })).filter(row => row.cells.some(Boolean));
  if (!rows.length) throw new Error("The file has no unit rows.");
  if (rows.length > IMPORT_MAX_ROWS) throw new Error(`Import at most ${IMPORT_MAX_ROWS.toLocaleString()} rows per file.`);
  return { columns, rows, warnings: warnings.slice(0, 30) };
}

const validId = (value: string) => value.length > 0 && value.length <= 120 && !/[\u0000-\u001f\u007f]/.test(value);
export const normalizeUnitId = (value: string) => value.trim().toUpperCase();

export async function previewImport(brandId: string, options: ImportOptions) {
  const source = await parseSource(options);
  const { mapping, mode } = options;
  const assigned = [mapping?.unit, mode === "multiple" ? mapping?.product : undefined, mapping?.order].filter((value): value is number => typeof value === "number");
  if (!Number.isInteger(mapping?.unit) || mapping.unit < 0 || mapping.unit >= source.columns.length || (mode === "multiple" && (!Number.isInteger(mapping.product) || mapping.product! < 0 || mapping.product! >= source.columns.length)) || assigned.some(value => !Number.isInteger(value) || value < 0 || value >= source.columns.length) || new Set(assigned).size !== assigned.length) throw new Error("Map a valid Unit ID column and use each source column only once.");
  if (mode !== "single" && mode !== "multiple") throw new Error("Select single or multiple product import.");
  const products = await db.productModel.findMany({ where: { brandId }, select: { id: true, name: true, sku: true } });
  const productById = new Map(products.map(product => [product.id, product]));
  if (mode === "single" && !productById.has(options.productId ?? "")) throw new Error("Select a product in your catalog.");
  const exactSku = new Map<string, Product[]>();
  for (const product of products) if (product.sku) exactSku.set(product.sku, [...(exactSku.get(product.sku) ?? []), product]);
  const seen = new Set<string>();
  const proposed = source.rows.map(({ rowNumber, cells }): PreviewRow => {
    const unitId = normalizeUnitId(cells[mapping.unit] ?? "");
    const sourceProduct = mode === "multiple" ? (cells[mapping.product!] ?? "").trim() : "";
    const orderId = typeof mapping.order === "number" ? (cells[mapping.order] ?? "").trim() : "";
    let product: Product | undefined = mode === "single" ? productById.get(options.productId ?? "") : undefined;
    if (mode === "multiple") {
      const mapped = options.productMap?.[sourceProduct];
      if (mapped) product = productById.get(mapped);
      else if (exactSku.get(sourceProduct)?.length === 1) product = exactSku.get(sourceProduct)![0];
    }
    let reason = "";
    let status: PreviewRow["status"] = "valid";
    if (!validId(unitId)) { status = "error"; reason = "Missing or invalid Unit ID (maximum 120 characters)."; }
    else if (seen.has(unitId)) { status = "duplicate"; reason = "Repeated Unit ID in this file."; }
    else if (!product) { status = "error"; reason = "Product is not matched to this brand."; }
    else if (orderId && !validId(orderId)) { status = "error"; reason = "Order ID is invalid (maximum 120 characters)."; }
    if (unitId) seen.add(unitId);
    return { rowNumber, unitId, sourceProduct, productId: product?.id ?? null, productName: product?.name ?? "Unmatched", orderId, status, reason };
  });
  const candidateIds = proposed.filter(row => row.status === "valid").map(row => row.unitId);
  const existing = new Set<string>();
  for (let start = 0; start < candidateIds.length; start += 500) {
    const found = await db.productUnit.findMany({ where: { brandId, serialNumber: { in: candidateIds.slice(start, start + 500) } }, select: { serialNumber: true } });
    found.forEach(unit => existing.add(unit.serialNumber));
  }
  proposed.forEach(row => { if (row.status === "valid" && existing.has(row.unitId)) { row.status = "existing"; row.reason = "Already exists in this brand."; } });
  const summary = { total: proposed.length, valid: proposed.filter(row => row.status === "valid").length, existing: proposed.filter(row => row.status === "existing").length, duplicate: proposed.filter(row => row.status === "duplicate").length, errors: proposed.filter(row => row.status === "error").length };
  return { columns: source.columns, sample: source.rows.slice(0, 5), warnings: source.warnings, products, rows: proposed, summary, unmatched: [...new Set(proposed.filter(row => row.sourceProduct && !row.productId).map(row => row.sourceProduct))] };
}

export async function commitImport(brandId: string, accountId: string, options: ImportOptions) {
  const preview = await previewImport(brandId, options);
  const valid = preview.rows.filter(row => row.status === "valid");
  if (!valid.length) throw new Error("There are no new valid units to import.");
  const batchId = randomUUID();
  const ids = new Map(valid.map(row => [row.rowNumber, randomUUID()]));
  const result = await db.$transaction(async tx => {
    const orders = [...new Set(valid.map(row => row.orderId).filter(Boolean))];
    for (let i = 0; i < orders.length; i += 500) await tx.purchaseOrder.createMany({ data: orders.slice(i, i + 500).map(orderNumber => ({ brandId, orderNumber })), skipDuplicates: true });
    const linkedOrders = await tx.purchaseOrder.findMany({ where: { brandId, orderNumber: { in: orders } }, select: { id: true, orderNumber: true, deliveredOn: true } });
    const orderIds = new Map(linkedOrders.map(order => [order.orderNumber, order.id]));
    const orderDates = new Map(linkedOrders.map(order => [order.orderNumber, order.deliveredOn]));
    for (let i = 0; i < valid.length; i += 500) await tx.productUnit.createMany({ data: valid.slice(i, i + 500).map(row => ({ id: ids.get(row.rowNumber)!, brandId, productModelId: row.productId!, purchaseOrderId: row.orderId ? orderIds.get(row.orderId) : null, serialNumber: row.unitId, status: row.orderId && orderDates.get(row.orderId) ? "DELIVERED" as const : "PENDING" as const })), skipDuplicates: true });
    const created = await tx.productUnit.findMany({ where: { brandId, id: { in: [...ids.values()] } }, select: { id: true } });
    const createdIds = new Set(created.map(unit => unit.id));
    const createdRows = valid.filter(row => createdIds.has(ids.get(row.rowNumber)!));
    await tx.unitLifecycleEvent.createMany({ data: createdRows.flatMap(row => [{ unitId: ids.get(row.rowNumber)!, eventType: "CREATED", accountId, source: `import:${batchId}` }, ...(row.orderId ? [{ unitId: ids.get(row.rowNumber)!, eventType: "ORDER_ASSOCIATED", accountId, source: `import:${batchId}`, orderNumber: row.orderId }] : []), ...(row.orderId && orderDates.get(row.orderId) ? [{ unitId: ids.get(row.rowNumber)!, eventType: "DELIVERED", accountId, source: `import:${batchId}`, orderNumber: row.orderId, detail: orderDates.get(row.orderId)!.toISOString().slice(0, 10) }] : [])]) });
    await tx.unitSale.createMany({ data: createdRows.filter(row => row.orderId).map(row => ({ unitId: ids.get(row.rowNumber)!, purchaseOrderId: orderIds.get(row.orderId)!, confirmedDeliveredOn: orderDates.get(row.orderId) })) });
    const insertedRows = created.length;
    const skippedRows = preview.summary.total - insertedRows;
    const history = await tx.unitImport.create({ data: { id: batchId, brandId, accountId, filename: options.filename.slice(0, 255), importType: "UNIT_REGISTRY", status: preview.summary.errors ? "COMPLETED_WITH_ERRORS" : "COMPLETED", totalRows: preview.summary.total, insertedRows, skippedRows, failedRows: preview.summary.errors, summary: `${insertedRows} created; ${skippedRows} skipped.` } });
    return { history, insertedRows, skippedRows, rows: preview.rows.map(row => row.status === "valid" && !createdIds.has(ids.get(row.rowNumber)!) ? { ...row, status: "existing" as const, reason: "Skipped because another import added this ID first." } : row) };
  }, { timeout: 120000 });
  return result;
}
