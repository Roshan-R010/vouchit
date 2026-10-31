import { createHash, randomUUID } from "node:crypto";
import { Prisma, UnitStatus } from "@prisma/client";
import { db } from "../src/lib/db";
import { FieldKey, FieldMapping, ImportType, validateMapping } from "../src/lib/import-fields";
import { ImportOptions, normalizeUnitId, parseSource } from "./unit-import";
import { changeUnitLifecycle } from "./unit-lifecycle";

export type BatchFile = Pick<ImportOptions, "filename" | "fileBase64" | "hasHeader" | "mode" | "productId" | "productMap"> & {
  importType: ImportType;
  mapping: FieldMapping;
  statusMap?: Record<string, "PENDING" | "DELIVERED" | "RETURNED" | "FOR_SALE_AGAIN" | "IGNORE">;
  profileId?: string;
};
export type BatchOptions = { files: BatchFile[]; previewToken?: string; confirmReturns?: boolean };
type Action = "CREATE" | "ASSOCIATE_ORDER" | "DELIVER" | "RETURN" | "FOR_SALE_AGAIN" | "EXPECTED_DATE";
type PlannedRow = { fileIndex: number; filename: string; rowNumber: number; unitId: string; orderId: string; productId: string | null; actions: Action[]; status: "new" | "update" | "return" | "unchanged" | "duplicate" | "ambiguous" | "error"; reason: string; existing: string; incoming: string; deliveredOn: string; expectedOn: string };
type State = { id: string | null; unitId: string; productId: string; sku: string | null; orderId: string; historicalOrders: string[]; status: UnitStatus; active: boolean; deliveredOn: string; expectedOn: string };
const iso = (value: Date | null | undefined) => value?.toISOString().slice(0, 10) ?? "";
const validId = (value: string) => value.length > 0 && value.length <= 120 && !/[\u0000-\u001f\u007f]/.test(value);
function parseDate(value: string, label: string, future = false) {
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must use YYYY-MM-DD.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || iso(date) !== value || (!future && date.getTime() > Date.now())) throw new Error(`${label} must be a valid date${future ? "" : " that is not in the future"}.`);
  return value;
}
function mapStatus(value: string, file: BatchFile, kind: "delivery" | "return") {
  if (!value) return "";
  const explicit = file.statusMap?.[value];
  if (explicit) {
    if (kind === "delivery" && (explicit === "RETURNED" || explicit === "FOR_SALE_AGAIN") || kind === "return" && (explicit === "PENDING" || explicit === "DELIVERED")) throw new Error(`Status mapping for “${value}” does not match this column.`);
    return explicit;
  }
  const normalized = value.toLowerCase().trim().replace(/[_-]+/g, " ");
  if (kind === "delivery") {
    if (["delivered", "delivery completed", "confirmed delivered"].includes(normalized)) return "DELIVERED";
    if (["pending", "in transit", "shipped", "awaiting delivery"].includes(normalized)) return "PENDING";
  } else {
    if (["returned", "return completed", "return closed", "completed return"].includes(normalized)) return "RETURNED";
    if (["for sale again", "ready for resale", "resale ready"].includes(normalized)) return "FOR_SALE_AGAIN";
    if (["not returned", "none", "no return"].includes(normalized)) return "IGNORE";
  }
  throw new Error(`Unknown ${kind} status “${value}”. Map this value before importing.`);
}
function checkOptions(options: BatchOptions) {
  if (!Array.isArray(options?.files) || !options.files.length || options.files.length > 5) throw new Error("Upload one to five CSV or XLSX files.");
  for (const file of options.files) if (!["UNIT_REGISTRY", "DELIVERY_UPDATES", "RETURN_UPDATES", "COMBINED"].includes(file.importType)) throw new Error("Choose a valid import type for each file.");
}

export async function planBatch(brandId: string, options: BatchOptions, client: Prisma.TransactionClient | typeof db = db) {
  checkOptions(options);
  const parsed = await Promise.all(options.files.map(file => parseSource({ ...file, mapping: { unit: -1 } })));
  parsed.forEach((source, index) => validateMapping(options.files[index].mapping, source.columns.length, options.files[index].importType));
  const allUnitIds = new Set<string>(), allOrderIds = new Set<string>();
  parsed.forEach((source, index) => source.rows.forEach(row => {
    const mapping = options.files[index].mapping;
    if (mapping.unitId !== undefined) allUnitIds.add(normalizeUnitId(row.cells[mapping.unitId] ?? ""));
    if (mapping.orderId !== undefined) allOrderIds.add((row.cells[mapping.orderId] ?? "").trim());
  }));
  const [products, existing] = await Promise.all([
    client.productModel.findMany({ where: { brandId }, select: { id: true, name: true, sku: true } }),
    client.productUnit.findMany({ where: { brandId, OR: [{ serialNumber: { in: [...allUnitIds].filter(Boolean) } }, { purchaseOrder: { orderNumber: { in: [...allOrderIds].filter(Boolean) } } }] }, include: { productModel: { select: { sku: true } }, purchaseOrder: { select: { orderNumber: true } }, registration: { select: { id: true } }, sales: { select: { isCurrent: true, confirmedDeliveredOn: true, expectedDeliveryOn: true, purchaseOrder: { select: { orderNumber: true } } } } } }),
  ]);
  const byId = new Map(products.map(product => [product.id, product]));
  const resolveProduct = (file: BatchFile, sourceProduct: string) => {
    const explicit = file.productMap?.[sourceProduct];
    if (explicit) return byId.has(explicit) ? explicit : null;
    const matches = products.filter(product => product.sku === sourceProduct || product.name.toLowerCase() === sourceProduct.toLowerCase());
    return matches.length === 1 ? matches[0].id : null;
  };
  const states = new Map<string, State>();
  existing.forEach(unit => states.set(unit.serialNumber, { id: unit.id, unitId: unit.serialNumber, productId: unit.productModelId, sku: unit.productModel.sku, orderId: unit.purchaseOrder?.orderNumber ?? "", historicalOrders: unit.sales.map(sale => sale.purchaseOrder.orderNumber), status: unit.status, active: !!unit.registration, deliveredOn: iso(unit.sales.find(sale => sale.isCurrent)?.confirmedDeliveredOn), expectedOn: iso(unit.sales.find(sale => sale.isCurrent)?.expectedDeliveryOn) }));
  const rows: PlannedRow[] = [];
  parsed.forEach((source, fileIndex) => {
    const file = options.files[fileIndex];
    const seenInFile = new Set<string>();
    for (const row of source.rows) {
      const value = (key: FieldKey) => file.mapping[key] === undefined ? "" : (row.cells[file.mapping[key]!] ?? "").trim();
      const unitId = normalizeUnitId(value("unitId"));
      const orderId = value("orderId");
      const planned: PlannedRow = { fileIndex, filename: file.filename, rowNumber: row.rowNumber, unitId, orderId, productId: null, actions: [], status: "error", reason: "", existing: "", incoming: "", deliveredOn: "", expectedOn: "" };
      let state: State | undefined;
      let original: State | null = null;
      try {
        if (unitId && !validId(unitId) || orderId && !validId(orderId)) throw new Error("Unit ID or Order ID is invalid (maximum 120 characters).");
        if (unitId && seenInFile.has(unitId)) { planned.status = "duplicate"; planned.reason = "Repeated Unit ID in this file."; rows.push(planned); continue; }
        if (unitId) seenInFile.add(unitId);
        const sku = value("sku");
        const matches = unitId ? [states.get(unitId)].filter((item): item is State => !!item) : [...states.values()].filter(item => item.orderId === orderId && (!sku || item.sku === sku));
        if (matches.length > 1) { planned.status = "ambiguous"; planned.reason = `Order ${orderId} matches ${matches.length} units. Add a Unit ID to this file.`; rows.push(planned); continue; }
        state = matches[0];
        original = state ? { ...state, historicalOrders: [...state.historicalOrders] } : null;
        if (!state && file.importType !== "UNIT_REGISTRY" && file.importType !== "COMBINED") throw new Error("No matching unit exists in this brand.");
        if (!state) {
          if (!unitId || !orderId) throw new Error("New units need both Unit ID and Order ID.");
          const sourceProduct = value("product") || sku;
          const productId = file.mode === "single" ? file.productId : resolveProduct(file, sourceProduct);
          if (!productId || !byId.has(productId)) throw new Error("Match this row to a product in the brand catalog.");
          state = { id: null, unitId, productId, sku: byId.get(productId)!.sku, orderId, historicalOrders: [orderId], status: "PENDING", active: false, deliveredOn: "", expectedOn: "" };
          states.set(unitId, state);
          planned.actions.push("CREATE");
        } else {
          planned.unitId = state.unitId;
          if ((file.importType === "UNIT_REGISTRY" || file.importType === "COMBINED") && (value("product") || sku)) {
            const mappedProduct = file.mode === "single" ? file.productId : resolveProduct(file, value("product") || sku);
            if (!mappedProduct || mappedProduct !== state.productId) throw new Error("Product identifier conflicts with this unit's catalog product.");
          }
          if (file.mapping.returnStatus !== undefined && mapStatus(value("returnStatus"), file, "return") === "FOR_SALE_AGAIN") {
            if (state.status !== "RETURNED" || state.active) throw new Error("Only a completed return can be marked For Sale Again.");
            planned.actions.push("FOR_SALE_AGAIN"); state.status = "FOR_SALE_AGAIN";
          }
          if (orderId && orderId !== state.orderId) {
            if (state.status !== "FOR_SALE_AGAIN" || state.active) throw new Error("A different order is current. Complete the return and mark For Sale Again first.");
            if (state.historicalOrders.includes(orderId)) throw new Error("This unit used that Order ID in an earlier sale. Use a new Order ID.");
            planned.actions.push("ASSOCIATE_ORDER");
            state.orderId = orderId; state.historicalOrders.push(orderId); state.status = "PENDING"; state.deliveredOn = ""; state.expectedOn = "";
          }
        }
        planned.productId = state.productId;
        planned.existing = original ? `${original.orderId || "No order"} · ${original.status} · ${original.deliveredOn || "No confirmed delivery"} · ${original.active ? "active warranty" : "no active warranty"}` : "New unit";
        const expectedOn = parseDate(value("expectedDeliveryOn"), "Expected delivery date", true);
        const deliveredOn = parseDate(value("confirmedDeliveryOn"), "Confirmed delivery date");
        const returnOn = parseDate(value("returnCompletedOn"), "Return completion date");
        const delivery = mapStatus(value("deliveryStatus"), file, "delivery");
        const returned = mapStatus(value("returnStatus"), file, "return");
        if (delivery === "DELIVERED" && !deliveredOn) throw new Error("A Delivered status needs a confirmed delivery date.");
        if (delivery === "PENDING" && deliveredOn) throw new Error("Pending delivery conflicts with a confirmed delivery date.");
        if (expectedOn && expectedOn !== state.expectedOn) { planned.actions.push("EXPECTED_DATE"); state.expectedOn = expectedOn; planned.expectedOn = expectedOn; }
        if (deliveredOn) {
          if (state.status === "PENDING") { planned.actions.push("DELIVER"); state.status = "DELIVERED"; state.deliveredOn = deliveredOn; planned.deliveredOn = deliveredOn; }
          else if (state.status !== "DELIVERED" || state.deliveredOn !== deliveredOn) throw new Error("This unit already has a different confirmed delivery or lifecycle status.");
        }
        if (returned === "RETURNED" || returnOn) {
          if (state.status === "RETURNED") { /* Repeated completed return is unchanged. */ }
          else {
            if (state.status !== "PENDING" && state.status !== "DELIVERED") throw new Error("This unit cannot be returned from its current status.");
            if (!state.orderId) throw new Error("Associate an order before recording a return.");
            planned.actions.push("RETURN"); state.status = "RETURNED"; state.active = false;
          }
        }
        if (returned === "FOR_SALE_AGAIN" && !planned.actions.includes("FOR_SALE_AGAIN")) {
          if (state.status !== "RETURNED" || state.active) throw new Error("Only a completed return can be marked For Sale Again.");
          planned.actions.push("FOR_SALE_AGAIN"); state.status = "FOR_SALE_AGAIN";
        }
        if (file.importType === "RETURN_UPDATES" && !planned.actions.includes("RETURN") && !planned.actions.includes("FOR_SALE_AGAIN") && returned !== "IGNORE" && state.status !== "RETURNED") throw new Error("This row does not confirm a completed return.");
        planned.orderId = state.orderId;
        planned.incoming = `${state.orderId || "No order"} · ${state.status}${deliveredOn ? ` · ${deliveredOn}` : ""}`;
        planned.status = planned.actions.includes("RETURN") ? "return" : planned.actions.includes("CREATE") ? "new" : planned.actions.length ? "update" : "unchanged";
      } catch (error) { if (state && original) Object.assign(state, original); else if (state && !original) states.delete(state.unitId); planned.actions = []; planned.status = "error"; planned.reason = error instanceof Error ? error.message : "Invalid row."; }
      rows.push(planned);
    }
  });
  const summary = { total: rows.length, new: rows.filter(row => row.actions.includes("CREATE")).length, updates: rows.filter(row => row.status === "update").length, returns: rows.filter(row => row.actions.includes("RETURN")).length, resales: rows.filter(row => row.actions.includes("FOR_SALE_AGAIN") || row.actions.includes("ASSOCIATE_ORDER")).length, unchanged: rows.filter(row => row.status === "unchanged").length, ambiguous: rows.filter(row => row.status === "ambiguous").length, duplicate: rows.filter(row => row.status === "duplicate").length, errors: rows.filter(row => row.status === "error").length };
  const previewToken = createHash("sha256").update(JSON.stringify({ rows, existing: existing.map(unit => [unit.id, unit.activeRegistrationId, unit.purchaseOrderId, unit.status, unit.sales.map(sale => [sale.purchaseOrder.orderNumber, sale.isCurrent, sale.confirmedDeliveredOn, sale.expectedDeliveryOn])]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))) })).digest("hex");
  return { files: parsed.map((source, index) => ({ filename: options.files[index].filename, columns: source.columns, sample: source.rows.slice(0, 3), warnings: source.warnings, rowCount: source.rows.length })), rows, summary, previewToken };
}

export async function commitBatch(brandId: string, accountId: string, options: BatchOptions) {
  if (!options.previewToken || !/^[a-f0-9]{64}$/.test(options.previewToken)) throw new Error("Refresh the import preview before confirming.");
  checkOptions(options);
  const sources = await Promise.all(options.files.map(file => parseSource({ ...file, mapping: { unit: -1 } })));
  const candidateUnits = [...new Set(sources.flatMap((source, index) => {
    const column = options.files[index].mapping?.unitId;
    return Number.isInteger(column) && column! >= 0 && column! < source.columns.length ? source.rows.map(row => normalizeUnitId(row.cells[column!] ?? "")).filter(Boolean) : [];
  }))];
  const candidateOrders = [...new Set(sources.flatMap((source, index) => {
    const column = options.files[index].mapping?.orderId;
    return Number.isInteger(column) && column! >= 0 && column! < source.columns.length ? source.rows.map(row => (row.cells[column!] ?? "").trim()).filter(Boolean) : [];
  }))];
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${brandId}))`;
    const affected = await tx.productUnit.findMany({ where: { brandId, OR: [{ serialNumber: { in: candidateUnits } }, { purchaseOrder: { orderNumber: { in: candidateOrders } } }] }, select: { id: true } });
    for (let start = 0; start < affected.length; start += 500) {
      const ids = affected.slice(start, start + 500).map(unit => Prisma.sql`${unit.id}::uuid`);
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "ProductUnit" WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`);
    }
    const plan = await planBatch(brandId, options, tx);
    if (plan.previewToken !== options.previewToken) throw new Error("Unit data changed since the preview. Refresh the preview before importing.");
    if (plan.summary.returns && options.confirmReturns !== true) throw new Error("Confirm that this import will deactivate affected customer warranties.");
    if (!plan.summary.new && !plan.summary.updates && !plan.summary.returns && !plan.summary.resales) throw new Error("There are no changes to import.");
    const importId = randomUUID();
    const newRows = plan.rows.filter(row => row.actions.includes("CREATE"));
    const orderNumbers = [...new Set(newRows.map(row => row.orderId))];
    for (let start = 0; start < orderNumbers.length; start += 500) await tx.purchaseOrder.createMany({ data: orderNumbers.slice(start, start + 500).map(orderNumber => ({ brandId, orderNumber })), skipDuplicates: true });
    const orders = await tx.purchaseOrder.findMany({ where: { brandId, orderNumber: { in: orderNumbers } }, select: { id: true, orderNumber: true } });
    const orderIds = new Map(orders.map(order => [order.orderNumber, order.id]));
    const created = new Map(newRows.map(row => [row.unitId, randomUUID()]));
    for (let start = 0; start < newRows.length; start += 500) {
      const batch = newRows.slice(start, start + 500);
      await tx.productUnit.createMany({ data: batch.map(row => ({ id: created.get(row.unitId)!, brandId, productModelId: row.productId!, serialNumber: row.unitId, purchaseOrderId: orderIds.get(row.orderId)! })) });
      await tx.unitSale.createMany({ data: batch.map(row => ({ unitId: created.get(row.unitId)!, purchaseOrderId: orderIds.get(row.orderId)! })) });
      await tx.unitLifecycleEvent.createMany({ data: batch.flatMap(row => [{ unitId: created.get(row.unitId)!, eventType: "CREATED", accountId, source: `import:${importId}` }, { unitId: created.get(row.unitId)!, eventType: "ORDER_ASSOCIATED", accountId, source: `import:${importId}`, orderNumber: row.orderId }]) });
    }
    const existingIds = new Map<string, string>();
    const unitNumbers = [...new Set(plan.rows.filter(row => row.actions.length && !row.actions.includes("CREATE")).map(row => row.unitId))];
    for (let start = 0; start < unitNumbers.length; start += 500) {
      const units = await tx.productUnit.findMany({ where: { brandId, serialNumber: { in: unitNumbers.slice(start, start + 500) } }, select: { id: true, serialNumber: true } });
      units.forEach(unit => existingIds.set(unit.serialNumber, unit.id));
    }
    for (const row of plan.rows) {
      if (!row.actions.length) continue;
      const unitId = created.get(row.unitId) ?? existingIds.get(row.unitId);
      if (!unitId) throw new Error(`Unit ${row.unitId} changed during import. Refresh the preview.`);
      if (row.actions.includes("FOR_SALE_AGAIN")) await changeUnitLifecycle(brandId, unitId, accountId, `import:${importId}`, { type: "FOR_SALE_AGAIN" }, tx);
      if (row.actions.includes("ASSOCIATE_ORDER")) await changeUnitLifecycle(brandId, unitId, accountId, `import:${importId}`, { type: "ASSOCIATE_ORDER", orderNumber: row.orderId }, tx);
      if (row.actions.includes("EXPECTED_DATE")) {
        const sale = await tx.unitSale.findFirst({ where: { unitId, isCurrent: true } });
        if (!sale) throw new Error(`Unit ${row.unitId} has no current sale.`);
        await tx.unitSale.update({ where: { id: sale.id }, data: { expectedDeliveryOn: new Date(`${row.expectedOn}T00:00:00.000Z`) } });
      }
      if (row.actions.includes("DELIVER")) await changeUnitLifecycle(brandId, unitId, accountId, `import:${importId}`, { type: "DELIVER", deliveredOn: row.deliveredOn }, tx);
      if (row.actions.includes("RETURN")) await changeUnitLifecycle(brandId, unitId, accountId, `import:${importId}`, { type: "RETURN" }, tx);
    }
    const skippedRows = plan.summary.unchanged + plan.summary.duplicate + plan.summary.ambiguous + plan.summary.errors;
    const profileIds = [...new Set(options.files.map(file => file.profileId).filter((id): id is string => !!id))];
    const profiles = await tx.importProfile.findMany({ where: { brandId, id: { in: profileIds } }, select: { id: true, name: true } });
    if (profiles.length !== profileIds.length) throw new Error("A selected import profile is no longer available in this brand.");
    if (profileIds.length) await tx.importProfile.updateMany({ where: { brandId, id: { in: profileIds } }, data: { lastUsedAt: new Date() } });
    const history = await tx.unitImport.create({ data: { id: importId, brandId, accountId, filename: options.files.map(file => file.filename).join(", ").slice(0, 255), importType: options.files.map(file => file.importType).join(", "), profileName: profiles.map(profile => profile.name).join(", ") || null, status: plan.summary.ambiguous + plan.summary.errors ? "COMPLETED_WITH_ERRORS" : "COMPLETED", totalRows: plan.summary.total, insertedRows: plan.summary.new, updatedRows: plan.summary.updates, returnedRows: plan.summary.returns, skippedRows, failedRows: plan.summary.ambiguous + plan.summary.errors, summary: JSON.stringify(plan.summary) } });
    return { history, summary: plan.summary, rows: plan.rows };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000 });
}
