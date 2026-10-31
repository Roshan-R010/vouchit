import test from "node:test";
import assert from "node:assert/strict";
import { planBatch } from "../server/advanced-import";

const brandId = "00000000-0000-0000-0000-000000000001";
const productId = "00000000-0000-0000-0000-000000000002";
const products = [{ id: productId, name: "Air Purifier", sku: "AIR-1" }];
const file = (name: string, csv: string, importType: "UNIT_REGISTRY" | "DELIVERY_UPDATES" | "RETURN_UPDATES", mapping: Record<string, number>) => ({ filename: name, fileBase64: Buffer.from(csv).toString("base64"), hasHeader: true, importType, mapping, mode: "single" as const, productId, productMap: {}, statusMap: {} });
const client = (units: any[] = []) => ({ productModel: { findMany: async () => products }, productUnit: { findMany: async () => units } }) as any;
const unit = (serialNumber: string, orderNumber: string, status: string, active = false) => ({ id: serialNumber, serialNumber, brandId, productModelId: productId, activeRegistrationId: active ? `reg-${serialNumber}` : null, purchaseOrderId: orderNumber, status, productModel: { sku: "AIR-1" }, purchaseOrder: { orderNumber }, registration: active ? { id: `reg-${serialNumber}` } : null, sales: [{ isCurrent: true, purchaseOrder: { orderNumber }, confirmedDeliveredOn: status === "DELIVERED" ? new Date("2026-10-01T00:00:00Z") : null, expectedDeliveryOn: null }] });

test("a second file can deliver a unit created by the first file", async () => {
  const files = [
    file("units.csv", "Serial Number,Order No\nJB001,ORD101\n", "UNIT_REGISTRY", { unitId: 0, orderId: 1 }),
    file("delivery.csv", "Order Number,Delivered On\nORD101,2026-10-02\n", "DELIVERY_UPDATES", { orderId: 0, confirmedDeliveryOn: 1 }),
  ];
  const plan = await planBatch(brandId, { files }, client());
  assert.equal(plan.summary.new, 1);
  assert.equal(plan.summary.updates, 1);
  assert.deepEqual(plan.rows.map(row => row.actions), [["CREATE"], ["DELIVER"]]);
});

test("order-only updates are ambiguous when an order contains multiple units", async () => {
  const files = [file("delivery.csv", "Order ID,Delivered On\nORD101,2026-10-02\n", "DELIVERY_UPDATES", { orderId: 0, confirmedDeliveryOn: 1 })];
  const plan = await planBatch(brandId, { files }, client([unit("JB001", "ORD101", "PENDING"), unit("JB002", "ORD101", "PENDING")]));
  assert.equal(plan.summary.ambiguous, 1);
  assert.match(plan.rows[0].reason, /matches 2 units/);
});

test("completed returns are explicit and repeated returns do not create new actions", async () => {
  const files = [file("returns.csv", "Unit ID,Return Status\nJB001,Return Closed\n", "RETURN_UPDATES", { unitId: 0, returnStatus: 1 })];
  const initial = await planBatch(brandId, { files }, client([unit("JB001", "ORD101", "DELIVERED", true)]));
  assert.equal(initial.summary.returns, 1);
  assert.deepEqual(initial.rows[0].actions, ["RETURN"]);
  const repeated = await planBatch(brandId, { files }, client([unit("JB001", "ORD101", "RETURNED")]));
  assert.equal(repeated.summary.returns, 0);
  assert.equal(repeated.summary.unchanged, 1);
});

test("return requests and unknown status values are not treated as completed returns", async () => {
  const files = [file("returns.csv", "Unit ID,Return Status\nJB001,Return Requested\n", "RETURN_UPDATES", { unitId: 0, returnStatus: 1 })];
  const plan = await planBatch(brandId, { files }, client([unit("JB001", "ORD101", "DELIVERED", true)]));
  assert.equal(plan.summary.errors, 1);
  assert.match(plan.rows[0].reason, /Unknown return status/);
});

test("preview token changes if the matching unit's active registration changes", async () => {
  const files = [file("returns.csv", "Unit ID,Return Status\nJB001,Returned\n", "RETURN_UPDATES", { unitId: 0, returnStatus: 1 })];
  const before = await planBatch(brandId, { files }, client([unit("JB001", "ORD101", "DELIVERED")]));
  const after = await planBatch(brandId, { files }, client([unit("JB001", "ORD101", "DELIVERED", true)]));
  assert.notEqual(before.previewToken, after.previewToken);
});

test("a completed return can be approved for resale and linked to a new order in one row", async () => {
  const files = [{ ...file("resale.csv", "Unit ID,Order ID,Return Status\nJB001,ORD2002,Ready for Resale\n", "RETURN_UPDATES", { unitId: 0, orderId: 1, returnStatus: 2 }) }];
  const plan = await planBatch(brandId, { files }, client([unit("JB001", "ORD1001", "RETURNED")]));
  assert.equal(plan.summary.resales, 1);
  assert.deepEqual(plan.rows[0].actions, ["FOR_SALE_AGAIN", "ASSOCIATE_ORDER"]);
  assert.equal(plan.rows[0].orderId, "ORD2002");
});

test("conflicting delivery dates are rejected without affecting the next file", async () => {
  const files = [
    file("bad.csv", "Unit ID,Delivered On\nJB001,2026-10-02\n", "DELIVERY_UPDATES", { unitId: 0, confirmedDeliveryOn: 1 }),
    file("same.csv", "Unit ID,Delivered On\nJB001,2026-10-01\n", "DELIVERY_UPDATES", { unitId: 0, confirmedDeliveryOn: 1 }),
  ];
  const plan = await planBatch(brandId, { files }, client([unit("JB001", "ORD101", "DELIVERED")]));
  assert.equal(plan.rows[0].status, "error");
  assert.equal(plan.rows[1].status, "unchanged");
});
