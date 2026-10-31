import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

function xlsx(rows: string[][]) {
  const sheetRows = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => `<c r="${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${value}</t></is></c>`).join("")}</row>`).join("");
  const files = {
    "[Content_Types].xml": `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
  };
  return Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([name, value]) => [name, strToU8(value)]))));
}

test("bulk import skips old rows on reupload and dual-ID registration checks the exact pair", async ({ page, browser }) => {
  const key = Math.random().toString(36).slice(2, 10);
  const brandUsername = `importbrand_${key}`;
  const customerUsername = `importcustomer_${key}`;
  let workspace = "";
  try {
    const signup = await page.request.post("/api/auth/signup", { data: { role: "BRAND", username: brandUsername, password: `SafePass_${key}`, displayName: `Import brand ${key}` } });
    expect(signup.status()).toBe(201);
    workspace = (await signup.json()).account.demoSessionId;
    expect((await page.request.post(`/api/demo/${workspace}/brand/setup`, { data: { name: `Import brand ${key}` } })).status()).toBe(201);
    const brand = (await (await page.request.get(`/api/demo/${workspace}/brand/products`)).json()).brand;
    const deliveredOn = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const productResponse = await page.request.post(`/api/demo/${workspace}/brand/products`, { data: { name: `Model ${key}`, sku: `SKU-${key}`, warrantyMonths: 36, verificationMode: "ORDER_AND_UNIT", serialNumber: `OLD-${key}`, orderNumber: `ORDER-A-${key}`, deliveredOn } });
    expect(productResponse.status()).toBe(200);
    const { product } = await productResponse.json();
    expect((await page.request.post(`/api/demo/${workspace}/brand/products/${product.id}/units`, { data: { serialNumber: `OTHER-${key}`, orderNumber: `ORDER-B-${key}`, deliveredOn } })).status()).toBe(201);
    await page.goto(`/demo/${workspace}/brand/products/import`);
    await expect(page.getByRole("heading", { name: "Import Units" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download Sample" })).toBeVisible();
    const first = `Unit ID,Product SKU,Order ID\n0000${key},SKU-${key},ORDER-A-${key}\nOLD-${key},SKU-${key},ORDER-A-${key}\n0000${key},SKU-${key},ORDER-A-${key}\n`;
    const makeOptions = (csv: string) => ({ filename: "units.csv", fileBase64: Buffer.from(csv).toString("base64"), hasHeader: true, mapping: { unit: 0, product: 1, order: 2 }, mode: "multiple" });
    const previewResponse = await page.request.post(`/api/demo/${workspace}/brand/unit-import/preview`, { data: makeOptions(first) });
    expect(previewResponse.status()).toBe(200);
    const preview = await previewResponse.json();
    expect(preview.summary).toMatchObject({ total: 3, valid: 1, existing: 1, duplicate: 1 });
    const imported = await page.request.post(`/api/demo/${workspace}/brand/unit-import/commit`, { data: makeOptions(first) });
    expect(imported.status()).toBe(200);
    expect((await imported.json()).insertedRows).toBe(1);
    const second = `Unit ID,Product SKU,Order ID\n0000${key},SKU-${key},ORDER-A-${key}\nNEW-${key},SKU-${key},ORDER-B-${key}\n`;
    const reimported = await page.request.post(`/api/demo/${workspace}/brand/unit-import/commit`, { data: makeOptions(second) });
    expect(reimported.status()).toBe(200);
    expect(await reimported.json()).toMatchObject({ insertedRows: 1, skippedRows: 1 });
    const listed = await (await page.request.get(`/api/demo/${workspace}/brand/products/${product.id}/units?page=1&size=25`)).json();
    expect(listed.total).toBe(4);
    expect(listed.units.some((unit: any) => unit.serialNumber === `0000${key.toUpperCase()}`)).toBe(true);
    const customer = await browser.newContext();
    try {
      const customerPage = await customer.newPage();
      expect((await customerPage.request.post("/api/auth/signup", { data: { role: "CUSTOMER", username: customerUsername, password: `SafePass_${key}`, displayName: `Customer ${key}`, email: `${key}@example.com` } })).status()).toBe(201);
      expect((await customerPage.request.post(`/api/demo/${workspace}/brand/unit-import/commit`, { data: makeOptions(first) })).status()).toBe(403);
      const endpoint = `/api/demo/${workspace}/register`;
      const mismatch = await customerPage.request.post(endpoint, { data: { brandSlug: brand.slug, productSlug: product.slug, serialNumber: `0000${key}`, orderNumber: `ORDER-B-${key}` } });
      expect(mismatch.status()).toBe(404);
      const correct = await customerPage.request.post(endpoint, { data: { brandSlug: brand.slug, productSlug: product.slug, serialNumber: `0000${key}`, orderNumber: `ORDER-A-${key}` } });
      expect(correct.status()).toBe(200);
      const duplicate = await customerPage.request.post(endpoint, { data: { brandSlug: brand.slug, productSlug: product.slug, serialNumber: `0000${key}`, orderNumber: `ORDER-A-${key}` } });
      expect((await duplicate.json()).alreadyRegistered).toBe(true);
      const orderOnlyProduct = (await (await page.request.post(`/api/demo/${workspace}/brand/products`, { data: { name: `Order model ${key}`, warrantyMonths: 12, verificationMode: "ORDER_ONLY", serialNumber: `ORDERUNIT-${key}`, orderNumber: `ORDER-ONLY-${key}`, deliveredOn } })).json()).product;
      const invalidOrder = await customerPage.request.post(endpoint, { data: { brandSlug: brand.slug, productSlug: orderOnlyProduct.slug, orderNumber: `UNKNOWN-${key}` } });
      expect(invalidOrder.status()).toBe(404);
      const validOrder = await customerPage.request.post(endpoint, { data: { brandSlug: brand.slug, productSlug: orderOnlyProduct.slug, orderNumber: `ORDER-ONLY-${key}` } });
      expect(validOrder.status()).toBe(200);
      const repeatedOrder = await customerPage.request.post(endpoint, { data: { brandSlug: brand.slug, productSlug: orderOnlyProduct.slug, orderNumber: `ORDER-ONLY-${key}` } });
      expect((await repeatedOrder.json()).alreadyRegistered).toBe(true);
    } finally { await customer.close(); }
    const secondProductResponse = await page.request.post(`/api/demo/${workspace}/brand/products`, { data: { name: `Second ${key}`, sku: `SKU2-${key}`, warrantyMonths: 12 } });
    const secondProduct = (await secondProductResponse.json()).product;
    const workbook = xlsx([["Device Code", "Model Code", "Order Reference"], [`XLSX-${key}-A`, `SKU-${key}`, `ORDER-A-${key}`], [`XLSX-${key}-B`, `SKU2-${key}`, ""]]);
    const spreadsheetOptions = { filename: "units.xlsx", fileBase64: workbook.toString("base64"), hasHeader: true, mapping: { unit: 0, product: 1, order: 2 }, mode: "multiple" };
    const spreadsheetPreview = await page.request.post(`/api/demo/${workspace}/brand/unit-import/preview`, { data: spreadsheetOptions });
    expect(spreadsheetPreview.status()).toBe(200);
    expect((await spreadsheetPreview.json()).summary).toMatchObject({ total: 2, valid: 2 });
    expect((await page.request.post(`/api/demo/${workspace}/brand/unit-import/commit`, { data: spreadsheetOptions })).status()).toBe(200);
    expect((await (await page.request.get(`/api/demo/${workspace}/brand/products/${secondProduct.id}/units`)).json()).total).toBe(1);
    const bulkIds = Array.from({ length: 1500 }, (_, index) => `BULK-${key}-${String(index).padStart(4, "0")}`);
    const bulkOptions = (rows: string[]) => ({ filename: "bulk.csv", fileBase64: Buffer.from(rows.join("\n") + "\n").toString("base64"), hasHeader: false, mapping: { unit: 0, product: null, order: null }, mode: "single", productId: product.id });
    const bulkPreview = await page.request.post(`/api/demo/${workspace}/brand/unit-import/preview`, { data: bulkOptions(bulkIds) });
    expect((await bulkPreview.json()).summary).toMatchObject({ total: 1500, valid: 1500 });
    const bulkImport = await page.request.post(`/api/demo/${workspace}/brand/unit-import/commit`, { data: bulkOptions(bulkIds) });
    expect((await bulkImport.json()).insertedRows).toBe(1500);
    const bulkReimport = await page.request.post(`/api/demo/${workspace}/brand/unit-import/commit`, { data: bulkOptions([...bulkIds, `BULK-${key}-NEW`]) });
    expect(await bulkReimport.json()).toMatchObject({ insertedRows: 1, skippedRows: 1500 });
  } finally {
    if (typeof process.loadEnvFile === "function") process.loadEnvFile();
    const { db } = await import("../src/lib/db");
    if (workspace) await db.demoSession.deleteMany({ where: { id: workspace } });
    await db.account.deleteMany({ where: { username: { in: [brandUsername, customerUsername] } } });
    await db.$disconnect();
  }
});
