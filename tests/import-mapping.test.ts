import test from "node:test";
import assert from "node:assert/strict";
import { suggestField, validateMapping } from "../src/lib/import-fields";
import { parseSource } from "../server/unit-import";
import { validProfileConfig } from "../server/import-profile";

const file = (csv: string) => ({ filename: "export.csv", fileBase64: Buffer.from(csv).toString("base64"), hasHeader: true, mapping: { unit: 0 }, mode: "single" as const });

test("suggestions distinguish product identifiers from physical unit IDs", () => {
  assert.equal(suggestField("Product Serial"), "unitId");
  assert.equal(suggestField("Order No"), "orderId");
  assert.equal(suggestField("Delivered At"), "confirmedDeliveryOn");
  assert.equal(suggestField("Product ID"), "product");
  assert.equal(suggestField("Unrelated metric"), null);
});

test("CSV parser accepts varying column counts and extra columns", async () => {
  for (const count of [3, 4, 5, 7, 15]) {
    const columns = Array.from({ length: count }, (_, index) => `Column ${index + 1}`);
    const source = await parseSource(file(`${columns.join(",")}\n${columns.map((_, index) => index).join(",")}\n`));
    assert.equal(source.columns.length, count);
    assert.equal(source.rows[0].cells.length, count);
  }
});

test("mapping requires fields according to import purpose", () => {
  assert.throws(() => validateMapping({ unitId: 0 }, 3, "UNIT_REGISTRY"), /Unit ID and Order ID/);
  assert.throws(() => validateMapping({ orderId: 0 }, 3, "DELIVERY_UPDATES"), /delivery date or status/);
  assert.doesNotThrow(() => validateMapping({ orderId: 0, confirmedDeliveryOn: 1 }, 3, "DELIVERY_UPDATES"));
  assert.doesNotThrow(() => validateMapping({ unitId: 0, returnStatus: 1 }, 3, "RETURN_UPDATES"));
});

test("duplicate and out-of-range column mappings are rejected", () => {
  assert.throws(() => validateMapping({ unitId: 0, orderId: 0 }, 3, "UNIT_REGISTRY"), /at most one/);
  assert.throws(() => validateMapping({ unitId: 0, orderId: 4 }, 3, "UNIT_REGISTRY"), /valid Vouch fields/);
});

test("unknown and extra columns can be skipped while explicit mappings remain intact", () => {
  const mapping = { unitId: 2, orderId: 0 };
  assert.doesNotThrow(() => validateMapping(mapping, 7, "UNIT_REGISTRY"));
  assert.deepEqual(mapping, { unitId: 2, orderId: 0 });
});

test("profiles store configuration without imported row data", () => {
  const config = validProfileConfig({ columns: ["Serial", "Order"], mapping: { unitId: 0, orderId: 1 }, importType: "UNIT_REGISTRY", mode: "single", productId: "", productMap: {}, statusMap: {}, rows: [{ customerEmail: "private@example.com" }] });
  assert.equal("rows" in config, false);
  assert.deepEqual(config.columns, ["Serial", "Order"]);
  assert.throws(() => validProfileConfig({ columns: ["Serial"], mapping: { unitId: 0 }, importType: "UNIT_REGISTRY", mode: "single" }), /Unit ID and Order ID/);
});
