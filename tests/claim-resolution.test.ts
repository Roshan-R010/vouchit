import test from "node:test";
import assert from "node:assert/strict";
import { resolutionSteps, updateClaimResolution } from "../server/claim-resolution";

const brandId = "00000000-0000-0000-0000-000000000001";
const sessionId = "00000000-0000-0000-0000-000000000002";
const claimId = "00000000-0000-0000-0000-000000000003";
const unitId = "00000000-0000-0000-0000-000000000004";
const replacementId = "00000000-0000-0000-0000-000000000005";
let sequence = 10;
const requestId = () => `00000000-0000-0000-0000-${String(sequence++).padStart(12, "0")}`;

function fixture() {
  const calls: string[] = [];
  const events: any[] = [];
  const notifications: any[] = [];
  const claim: any = { id: claimId, status: "APPROVED", resolutionMethod: null, registration: { unit: { id: unitId, brandId, serialNumber: "ORIGINAL" } }, resolution: null };
  const tx: any = {
    $queryRaw: async () => [{ id: claimId }],
    warrantyClaim: { findFirst: async () => claim, update: async ({ data }: any) => { Object.assign(claim, data); calls.push(`claim:${data.status || data.resolutionMethod || "refund"}`); } },
    claimResolution: {
      create: async ({ data }: any) => { claim.resolution = { id: "resolution-1", ...data }; return claim.resolution; },
      update: async ({ data }: any) => { claim.resolution = { ...claim.resolution, ...data }; return claim.resolution; },
    },
    claimResolutionEvent: {
      findUnique: async ({ where }: any) => events.find(event => event.requestId === where.requestId) || null,
      create: async ({ data }: any) => { const event = { id: `event-${events.length + 1}`, ...data, resolution: claim.resolution }; events.push(event); calls.push(`event:${data.action}`); return event; },
    },
    productUnit: { findFirst: async () => ({ id: replacementId, brandId, purchaseOrderId: null, activeRegistrationId: null, registrations: [] }) },
    unitLifecycleEvent: { create: async ({ data }: any) => { calls.push(`unit:${data.eventType}`); }, createMany: async ({ data }: any) => { calls.push(`unit:${data[0].eventType}`); } },
    claimEvent: { create: async () => { calls.push("claim-event:resolved"); } },
  };
  const client: any = { $transaction: async (fn: any) => fn(tx), claimResolutionEvent: tx.claimResolutionEvent, demoNotification: { create: async ({ data }: any) => { notifications.push(data); calls.push("notification"); } } };
  const update = (action: string, extra: Record<string, unknown> = {}) => updateClaimResolution(brandId, sessionId, claimId, null, { action: action as any, requestId: requestId(), ...extra }, client);
  return { claim, events, notifications, calls, update, client };
}

for (const [type, progress] of [
  ["REPAIR", "REPAIR_COMPLETED"],
  ["REPLACEMENT", "REPLACEMENT_DELIVERED"],
  ["REFUND", "REFUND_COMPLETED"],
] as const) {
  test(`${type.toLowerCase()} stays approved until operational completion and records one resolved event`, async () => {
    const state = fixture();
    await state.update("START", { type });
    assert.equal(state.claim.status, "APPROVED");
    await assert.rejects(() => state.update("COMPLETE"), /Record .* before completing/);
    assert.equal(state.claim.status, "APPROVED");
    for (const step of resolutionSteps[type].slice(1, -1)) {
      await state.update("PROGRESS", { step, ...(type === "REFUND" && step === progress ? { refundAmount: "109.50", refundCurrency: "INR" } : {}), ...(type === "REPLACEMENT" && step === "REPLACEMENT_PREPARED" ? { replacementUnitId: replacementId } : {}) });
      assert.equal(state.claim.status, "APPROVED");
      assert.equal(state.claim.resolution.step, step);
    }
    const completed = await state.update("COMPLETE");
    assert.equal(completed.resolution.status, "COMPLETED");
    assert.equal(state.claim.status, "RESOLVED");
    assert.equal(state.calls.filter(call => call === "claim-event:resolved").length, 1);
    assert.equal(state.notifications.filter(notification => notification.subject === "Claim resolution completed").length, 1);
    await assert.rejects(() => state.update("PROGRESS", { step: progress }), /active approved resolution/);
  });
}

test("replacement links units without changing warranty ownership; cancel and restart preserve history", async () => {
  const state = fixture();
  await state.update("START", { type: "REPLACEMENT" });
  await state.update("PROGRESS", { step: "REPLACEMENT_PREPARED", replacementUnitId: replacementId });
  assert.equal(state.claim.resolution.replacementUnitId, replacementId);
  await state.update("CANCEL", { internalNote: "Supplier changed allocation" });
  assert.equal(state.claim.status, "APPROVED");
  await state.update("RESTART", { type: "REFUND", internalNote: "Customer chose refund" });
  assert.equal(state.claim.resolution.replacementUnitId, null);
  assert.equal(state.events.length, 4);
  assert.ok(state.calls.includes("unit:REPLACEMENT_UNLINKED"));
  assert.equal(state.calls.some(call => call.includes("registration")), false);
});

test("replaying a request does not duplicate events or notifications", async () => {
  const state = fixture();
  const id = requestId();
  const input = { action: "START" as const, requestId: id, type: "REPAIR" as const };
  await updateClaimResolution(brandId, sessionId, claimId, null, input, state.client);
  const replay = await updateClaimResolution(brandId, sessionId, claimId, null, input, state.client);
  assert.equal(replay.replayed, true);
  assert.equal(state.events.length, 1);
  assert.equal(state.notifications.length, 1);
});
