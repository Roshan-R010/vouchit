export type ImportType = "UNIT_REGISTRY" | "DELIVERY_UPDATES" | "RETURN_UPDATES" | "COMBINED";
export const importTypes: { value: ImportType; label: string }[] = [
  { value: "UNIT_REGISTRY", label: "Unit registry" },
  { value: "DELIVERY_UPDATES", label: "Delivery updates" },
  { value: "RETURN_UPDATES", label: "Completed returns" },
  { value: "COMBINED", label: "Combined file" },
];
export type FieldKey = "unitId" | "orderId" | "product" | "sku" | "expectedDeliveryOn" | "confirmedDeliveryOn" | "deliveryStatus" | "returnStatus" | "returnCompletedOn";
export type FieldMapping = Partial<Record<FieldKey, number>>;
export const importFields: { key: FieldKey; label: string; description: string; type: string; aliases: string[]; importTypes: ImportType[] }[] = [
  { key: "unitId", label: "Unit ID", description: "Unique physical unit or serial number", type: "text", aliases: ["unitid", "unit", "serial", "serialnumber", "serialno", "deviceid", "productserial"], importTypes: ["UNIT_REGISTRY", "DELIVERY_UPDATES", "RETURN_UPDATES", "COMBINED"] },
  { key: "orderId", label: "Order ID", description: "Customer order reference", type: "text", aliases: ["orderid", "orderno", "ordernumber", "orderref", "orderreference", "purchaseorder"], importTypes: ["UNIT_REGISTRY", "DELIVERY_UPDATES", "RETURN_UPDATES", "COMBINED"] },
  { key: "product", label: "Product identifier", description: "Product name, SKU or catalog mapping", type: "text", aliases: ["product", "productname", "model", "modelname", "modelcode", "productid"], importTypes: ["UNIT_REGISTRY", "COMBINED"] },
  { key: "sku", label: "SKU", description: "Catalog SKU; useful when an order contains multiple products", type: "text", aliases: ["sku", "productsku", "itemsku"], importTypes: ["UNIT_REGISTRY", "DELIVERY_UPDATES", "RETURN_UPDATES", "COMBINED"] },
  { key: "expectedDeliveryOn", label: "Expected delivery date", description: "Planned date; does not confirm delivery", type: "date", aliases: ["expecteddelivery", "expecteddeliverydate", "eta"], importTypes: ["UNIT_REGISTRY", "DELIVERY_UPDATES", "COMBINED"] },
  { key: "confirmedDeliveryOn", label: "Confirmed delivery date", description: "Actual date the unit was delivered", type: "date", aliases: ["deliveredon", "deliveredat", "deliverydate", "actualdeliverydate", "confirmeddeliverydate"], importTypes: ["UNIT_REGISTRY", "DELIVERY_UPDATES", "COMBINED"] },
  { key: "deliveryStatus", label: "Delivery status", description: "Pending or confirmed delivered", type: "status", aliases: ["deliverystatus", "shippingstate", "fulfillmentstatus", "shipmentstatus"], importTypes: ["DELIVERY_UPDATES", "COMBINED"] },
  { key: "returnStatus", label: "Return status", description: "Completed return only", type: "status", aliases: ["returnstatus", "returnstate", "rma"], importTypes: ["RETURN_UPDATES", "COMBINED"] },
  { key: "returnCompletedOn", label: "Return completion date", description: "Date return was completed", type: "date", aliases: ["returncompletedon", "returnedon", "returnclosedon"], importTypes: ["RETURN_UPDATES", "COMBINED"] },
];
const normalized = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");
export function suggestField(column: string): FieldKey | null {
  const matches = importFields.filter(field => field.aliases.includes(normalized(column)));
  return matches.length === 1 ? matches[0].key : null;
}
export function validateMapping(mapping: FieldMapping, columnCount: number, type: ImportType) {
  const entries = Object.entries(mapping).filter((entry): entry is [FieldKey, number] => typeof entry[1] === "number");
  if (entries.some(([key, index]) => !importFields.some(field => field.key === key && field.importTypes.includes(type)) || !Number.isInteger(index) || index < 0 || index >= columnCount)) throw new Error("Choose valid Vouch fields for the uploaded columns.");
  if (new Set(entries.map(([, index]) => index)).size !== entries.length) throw new Error("Map each source column to at most one Vouch field.");
  const has = (key: FieldKey) => typeof mapping[key] === "number";
  if (type === "UNIT_REGISTRY" && (!has("unitId") || !has("orderId"))) throw new Error("Unit registry files need Unit ID and Order ID mappings.");
  if (type === "COMBINED" && !has("unitId")) throw new Error("Combined files need a Unit ID mapping.");
  if ((type === "DELIVERY_UPDATES" || type === "RETURN_UPDATES") && !has("unitId") && !has("orderId")) throw new Error("Update files need a Unit ID or Order ID mapping.");
  if (type === "DELIVERY_UPDATES" && !has("confirmedDeliveryOn") && !has("expectedDeliveryOn") && !has("deliveryStatus")) throw new Error("Map a delivery date or status.");
  if (type === "RETURN_UPDATES" && !has("returnStatus") && !has("returnCompletedOn")) throw new Error("Map a completed return field.");
}
