import { test } from "node:test";
import { strict as assert } from "node:assert";
import { costInput, templateInput } from "../server/claim-admin";

test("claim expenses parse INR to exact paise", () => {
  assert.equal(costInput({ category: "OTHER", amount: "199.99", currency: "INR" }).amountPaise, 19999);
  assert.equal(costInput({ category: "OTHER", amount: "0.01" }).amountPaise, 1);
  assert.equal(costInput({ category: "OTHER", amount: "0" }).amountPaise, 0);
  assert.equal(costInput({ category: "OTHER", amount: "9999999.99" }).amountPaise, 999999999);
});

test("claim expenses reject malformed amounts and other currencies", () => {
  for (const amount of ["", "-1", "1.001", "1e3", "NaN", "10000000", "01.00", 1.25]) {
    assert.throws(() => costInput({ category: "OTHER", amount }));
  }
  assert.throws(() => costInput({ category: "OTHER", amount: "1", currency: "USD" }));
  assert.throws(() => costInput({ category: "UNKNOWN", amount: "1" }));
});

test("templates trim text and reject empty or oversized fields", () => {
  assert.deepEqual(templateInput({ name: "  Approved  ", category: "APPROVE", body: "  Done.  " }), { name: "Approved", category: "APPROVE", body: "Done." });
  assert.throws(() => templateInput({ name: " ", category: "APPROVE", body: "Done." }));
  assert.throws(() => templateInput({ name: "A", category: "REJECT", body: " " }));
  assert.throws(() => templateInput({ name: "A", category: "REQUEST_INFO", body: "x".repeat(2001) }));
});
