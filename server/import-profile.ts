import { FieldMapping, ImportType, validateMapping } from "../src/lib/import-fields";

const types = new Set<ImportType>(["UNIT_REGISTRY", "DELIVERY_UPDATES", "RETURN_UPDATES", "COMBINED"]);
export function validProfileConfig(value: any) {
  if (!value || !types.has(value.importType) || !Array.isArray(value.columns) || !value.columns.length || value.columns.length > 30 || value.columns.some((column: unknown) => typeof column !== "string" || column.length > 120) || !value.mapping || typeof value.mapping !== "object") throw new Error("Choose a valid import type and source columns.");
  const mapping: FieldMapping = value.mapping;
  validateMapping(mapping, value.columns.length, value.importType);
  if (value.mode !== "single" && value.mode !== "multiple") throw new Error("Choose a valid product matching mode.");
  if (value.productId && (typeof value.productId !== "string" || value.productId.length > 50)) throw new Error("Choose a valid product.");
  const cleanMap = (input: unknown, allowed: (text: string) => boolean) => {
    if (input == null) return {};
    if (typeof input !== "object" || Array.isArray(input)) throw new Error("Check the profile mappings.");
    const entries = Object.entries(input);
    if (entries.length > 200 || entries.some(([key, entry]) => key.length > 120 || typeof entry !== "string" || !allowed(entry))) throw new Error("Check the profile mappings.");
    return Object.fromEntries(entries);
  };
  return { columns: value.columns, mapping, importType: value.importType as ImportType, mode: value.mode, productId: value.productId ?? "", productMap: cleanMap(value.productMap, text => /^[0-9a-f-]{36}$/i.test(text)), statusMap: cleanMap(value.statusMap, text => ["PENDING", "DELIVERED", "RETURNED", "FOR_SALE_AGAIN", "IGNORE"].includes(text)) };
}
