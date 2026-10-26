import { expect, test } from "@playwright/test";

let testKey = "";
let testWorkspace = "";
test.afterEach(async () => {
  if (!testKey) return;
  if (typeof process.loadEnvFile === "function") process.loadEnvFile();
  const { db } = await import("../src/lib/db");
  if (testWorkspace) await db.demoSession.deleteMany({ where: { id: testWorkspace } });
  await db.account.deleteMany({ where: { username: { in: [`brand_${testKey}`, `customer_${testKey}`, `other_${testKey}`] } } });
  await db.$disconnect();
});

test("brand link opens publicly, customer signs in, and warranties stay private", async ({ page, browser }) => {
  const key = Math.random().toString(36).slice(2, 10);
  testKey = key;
  await page.goto("/");
  await page.getByRole("link", { name: "Brand", exact: true }).click();
  await page.getByRole("button", { name: /Create an account/ }).click();
  await page.getByLabel("Full name").fill(`Brand owner ${key}`);
  await page.getByLabel("Username").fill(`brand_${key}`);
  await page.getByLabel("Password").fill(`TestPass_${key}`);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/demo\/[0-9a-f-]{36}\/setup$/);
  const sessionId = page.url().split("/")[4];
  testWorkspace = sessionId;
  await page.getByLabel("Brand name").fill(`Brand ${key}`);
  await page.getByRole("button", { name: "Create brand" }).click();
  await expect(page).toHaveURL(new RegExp(`/demo/${sessionId}/brand$`));
  expect((await page.request.get("/api/account/customer")).status()).toBe(401);
  await page.request.post("/api/auth/logout");
  await page.goto("/login/brand");
  await page.getByLabel("Username").fill(`brand_${key}`);
  await page.getByLabel("Password").fill(`TestPass_${key}`);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/demo/${sessionId}/brand$`));

  const created = await page.request.post(`/api/demo/${sessionId}/brand/products`, { data: {
    name: `Product ${key}`, warrantyMonths: 36, serialNumber: `SER-${key}`, orderNumber: `ORD-${key}`, deliveredOn: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
  } });
  expect(created.ok()).toBeTruthy();
  const { product } = await created.json();
  const brandData = await (await page.request.get(`/api/demo/${sessionId}/brand/products`)).json();
  const link = `/demo/${sessionId}/register/${brandData.brand.slug}/${product.slug}`;

  const customer = await browser.newContext();
  const customerPage = await customer.newPage();
  await customerPage.goto(link);
  await expect(customerPage.getByText(`Product ${key}`, { exact: true }).first()).toBeVisible();
  await customerPage.getByRole("button", { name: new RegExp(`Product ${key}`) }).click();
  await customerPage.getByLabel("Serial number").fill(`SER-${key}`);
  await customerPage.getByRole("button", { name: "Sign in to register" }).click();
  await expect(customerPage).toHaveURL(/\/login\/customer\?next=/);
  await customerPage.getByRole("button", { name: /Create an account/ }).click();
  await customerPage.getByLabel("Full name").fill(`Customer ${key}`);
  await customerPage.getByLabel("Email").fill(`${key}@example.com`);
  await customerPage.getByLabel("Username").fill(`customer_${key}`);
  await customerPage.getByLabel("Password").fill(`TestPass_${key}`);
  await customerPage.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(customerPage).toHaveURL(new RegExp(`/demo/${sessionId}/register/`));
  await customerPage.getByRole("button", { name: "Register warranty" }).click();
  await expect(customerPage).toHaveURL(/\/customer$/);
  await expect(customerPage.getByText(`Product ${key}`, { exact: true })).toBeVisible();
  await expect(customerPage.getByText("SER-" + key)).toBeVisible();
  expect((await customerPage.request.get(`/api/demo/${sessionId}/brand/products`)).status()).toBe(403);
  await customerPage.request.post("/api/auth/logout");
  await customerPage.goto("/login/customer");
  await customerPage.getByLabel("Username").fill(`customer_${key}`);
  await customerPage.getByLabel("Password").fill(`TestPass_${key}`);
  await customerPage.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(customerPage).toHaveURL(/\/customer$/);
  await expect(customerPage.getByText(`Product ${key}`, { exact: true })).toBeVisible();

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("/login/customer");
  await otherPage.getByRole("button", { name: /Create an account/ }).click();
  await otherPage.getByLabel("Full name").fill(`Other ${key}`);
  await otherPage.getByLabel("Email").fill(`other_${key}@example.com`);
  await otherPage.getByLabel("Username").fill(`other_${key}`);
  await otherPage.getByLabel("Password").fill(`TestPass_${key}`);
  await otherPage.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(otherPage).toHaveURL(/\/customer$/);
  await expect(otherPage.getByText(`Product ${key}`, { exact: true })).toHaveCount(0);
  const detail = await otherPage.request.get(`/api/demo/${sessionId}/customer/products/${(await customerPage.request.get('/api/account/customer').then(r => r.json())).warranties[0].unitId}`);
  expect(detail.status()).toBe(404);
  const duplicate = await otherPage.request.post(`/api/demo/${sessionId}/register`, { data: { brandSlug: brandData.brand.slug, productSlug: product.slug, serialNumber: `SER-${key}` } });
  expect(duplicate.status()).toBe(409);
  await customer.close();
  await other.close();
});
