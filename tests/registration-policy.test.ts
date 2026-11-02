import test from "node:test";
import assert from "node:assert/strict";
import { isLateRegistration, parseRegistrationPolicy, registrationDeadline } from "../server/registration-policy";

const delivery = new Date("2026-11-01T00:00:00.000Z");

test("registration deadline uses UTC calendar days and includes the final day", () => {
  assert.equal(registrationDeadline(delivery, 30).toISOString().slice(0, 10), "2026-12-01");
  assert.equal(isLateRegistration(delivery, 30, new Date("2026-12-01T23:59:59.999Z")), false);
  assert.equal(isLateRegistration(delivery, 30, new Date("2026-12-02T00:00:00.000Z")), true);
  assert.equal(isLateRegistration(new Date("2026-12-30T00:00:00.000Z"), 7, new Date("2027-01-06T16:00:00.000Z")), false);
});

test("a custom registration window is accepted within the supported range", () => {
  assert.deepEqual(parseRegistrationPolicy({ registrationWindowDays: 45, lateRegistrationAction: "MANUAL_REVIEW" }), { registrationWindowDays: 45, lateRegistrationAction: "MANUAL_REVIEW" });
  assert.deepEqual(parseRegistrationPolicy({ registrationWindowDays: null, lateRegistrationAction: "REJECT" }), { registrationWindowDays: null, lateRegistrationAction: "REJECT" });
});

test("invalid registration windows and actions are rejected server side", () => {
  for (const days of [undefined, "", "30", 0, -1, 1.5, 3651, Infinity, NaN]) {
    assert.throws(() => parseRegistrationPolicy({ registrationWindowDays: days, lateRegistrationAction: "REJECT" }));
  }
  assert.throws(() => parseRegistrationPolicy({ registrationWindowDays: 30, lateRegistrationAction: "APPROVE" }));
});
