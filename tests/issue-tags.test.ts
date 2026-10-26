import assert from "node:assert/strict";
import test from "node:test";
import { normalizeIssueTags, selectProductIssueTags } from "../src/lib/issue-tags";

test("product tags allow none through six, trim whitespace, and preserve readable labels", () => {
  assert.deepEqual(normalizeIssueTags([]), []);
  assert.deepEqual(normalizeIssueTags(["  Power   issue ", "Noise"]), ["Power issue", "Noise"]);
  assert.equal(normalizeIssueTags(["A", "B", "C", "D", "E", "F"]).length, 6);
});

test("rejects excessive, duplicate, empty, overlong, and non-text tags", () => {
  for (const input of [null, "Noise", [1], [" "], ["x".repeat(41)], ["Noise", " noise "], ["A", "B", "C", "D", "E", "F", "G"]]) {
    assert.throws(() => normalizeIssueTags(input));
  }
});

test("claims may select several configured issues, using the product's canonical labels", () => {
  assert.deepEqual(selectProductIssueTags(["noise", "POWER ISSUE"], ["Power issue", "Noise"]), ["Noise", "Power issue"]);
  assert.deepEqual(selectProductIssueTags([], ["Noise"]), []);
});

test("rejects claims that send unconfigured, removed, or duplicate tags", () => {
  assert.throws(() => selectProductIssueTags(["Noise"], []));
  assert.throws(() => selectProductIssueTags(["Leak"], ["Noise"]));
  assert.throws(() => selectProductIssueTags(["Noise", "noise"], ["Noise"]));
});

test("a saved selection stays independent of later changes to product options", () => {
  const options = ["Noise"];
  const selected = selectProductIssueTags(["Noise"], options);
  options[0] = "Vibration";
  assert.deepEqual(selected, ["Noise"]);
});
