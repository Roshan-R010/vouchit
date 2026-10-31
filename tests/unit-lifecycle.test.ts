import test from "node:test";
import assert from "node:assert/strict";
import { changeUnitLifecycle } from "../server/unit-lifecycle";

const brandId = "00000000-0000-0000-0000-000000000001";
const unitId = "00000000-0000-0000-0000-000000000002";
function fixture(status = "DELIVERED", registered = true) {
  const calls: string[] = [];
  const unit: any = { id: unitId, brandId, serialNumber: "JB001", status, activeRegistrationId: registered ? "reg-1" : null, purchaseOrderId: "order-1", purchaseOrder: { orderNumber: "ORD1001" }, productModel: { name: "Air Purifier" }, sales: [{ id: "sale-1", isCurrent: true }], registration: registered ? { id: "reg-1", customer: { demoSessionId: "session-1" }, claim: { id: "claim-1", status: "APPROVED" } } : null };
  const tx: any = {
    $queryRaw: async () => [{ id: unitId }],
    productUnit: { findFirst: async () => unit, update: async ({ data }: any) => { calls.push(`unit:${data.status}`); Object.assign(unit, data); }, findUniqueOrThrow: async () => unit },
    warrantyRegistration: { update: async ({ data }: any) => { calls.push(`registration:${data.active}`); } },
    warrantyClaim: { update: async ({ data }: any) => { calls.push(`claim-review:${data.requiresReturnReview}`); } },
    claimEvent: { create: async () => { calls.push("claim-event"); } },
    demoNotification: { create: async () => { calls.push("notification"); } },
    unitLifecycleEvent: { create: async ({ data }: any) => { calls.push(`event:${data.eventType}`); } },
    purchaseOrder: { upsert: async () => ({ id: "order-2", orderNumber: "ORD2002" }) },
    unitSale: { count: async () => 0, update: async () => { calls.push("old-sale-ended"); }, create: async () => { calls.push("new-sale"); } },
  };
  return { unit, calls, tx };
}

test("return atomically deactivates warranty, flags an open claim, records events and notifies", async () => {
  const { unit, calls, tx } = fixture();
  await changeUnitLifecycle(brandId, unitId, "account-1", "brand", { type: "RETURN" }, tx);
  assert.equal(unit.status, "RETURNED");
  assert.equal(unit.activeRegistrationId, null);
  assert.deepEqual(calls, ["claim-review:true", "claim-event", "registration:false", "unit:RETURNED", "event:WARRANTY_DEACTIVATED", "notification", "event:RETURNED"]);
});

test("resale requires a completed return and never reactivates the old registration", async () => {
  const active = fixture();
  await assert.rejects(() => changeUnitLifecycle(brandId, unitId, null, "brand", { type: "FOR_SALE_AGAIN" }, active.tx), /Complete the return/);
  assert.deepEqual(active.calls, []);
  const returned = fixture("RETURNED", false);
  await changeUnitLifecycle(brandId, unitId, null, "brand", { type: "FOR_SALE_AGAIN" }, returned.tx);
  await changeUnitLifecycle(brandId, unitId, null, "brand", { type: "ASSOCIATE_ORDER", orderNumber: "ORD2002" }, returned.tx);
  assert.equal(returned.unit.status, "PENDING");
  assert.deepEqual(returned.calls, ["unit:FOR_SALE_AGAIN", "event:FOR_SALE_AGAIN", "old-sale-ended", "new-sale", "unit:PENDING", "event:ORDER_ASSOCIATED"]);
});
