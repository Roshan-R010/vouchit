import { expect, test } from "@playwright/test";

let workspaceId = "";
let usernames: string[] = [];

test.afterEach(async () => {
  if (typeof process.loadEnvFile === "function") process.loadEnvFile();
  const { db } = await import("../src/lib/db");
  if (workspaceId) await db.demoSession.deleteMany({ where: { id: workspaceId } });
  if (usernames.length) await db.account.deleteMany({ where: { username: { in: usernames } } });
  await db.$disconnect();
});

test("brand filters claims by product-specific and cross-product issue tags", async ({ page, browser }) => {
  const key = Math.random().toString(36).slice(2, 9);
  const brandUsername = `filter_brand_${key}`;
  const customerUsername = `filter_customer_${key}`;
  usernames = [brandUsername, customerUsername];
  const password = `FilterPass_${key}`;

  const signup = await page.request.post("/api/auth/signup", { data: { role: "BRAND", username: brandUsername, password, displayName: `Filter Brand ${key}` } });
  expect(signup.ok()).toBeTruthy();
  workspaceId = (await signup.json()).account.demoSessionId;
  const setup = await page.request.post(`/api/demo/${workspaceId}/brand/setup`, { data: { name: `Filter Brand ${key}` } });
  expect(setup.ok()).toBeTruthy();
  const brand = (await setup.json()).brand;

  const firstTags = ["No cooling", "Loud noise", "Leaking", "Power failure", "Fan blocked", "Bad smell"];
  const secondTags = ["Battery", "Display", "Buttons", "Charging", "Connectivity", "Pairing"];
  const deliveredOn = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const firstResponse = await page.request.post(`/api/demo/${workspaceId}/brand/products`, { data: { name: `Cooler ${key}`, warrantyMonths: 36, serialNumber: `COOL-${key}`, orderNumber: `ORDER-C-${key}`, deliveredOn, issueTags: firstTags } });
  const secondResponse = await page.request.post(`/api/demo/${workspaceId}/brand/products`, { data: { name: `Speaker ${key}`, warrantyMonths: 36, serialNumber: `SPEAK-${key}`, orderNumber: `ORDER-S-${key}`, deliveredOn, issueTags: secondTags } });
  expect(firstResponse.ok()).toBeTruthy();
  expect(secondResponse.ok()).toBeTruthy();
  const firstProduct = (await firstResponse.json()).product;
  const secondProduct = (await secondResponse.json()).product;

  const customer = await browser.newContext();
  const customerPage = await customer.newPage();
  const customerSignup = await customerPage.request.post("/api/auth/signup", { data: { role: "CUSTOMER", username: customerUsername, password, displayName: `Customer ${key}`, email: `${key}@filters.example` } });
  expect(customerSignup.ok()).toBeTruthy();

  const firstRegistration = await customerPage.request.post(`/api/demo/${workspaceId}/register`, { data: { brandSlug: brand.slug, productSlug: firstProduct.slug, serialNumber: `COOL-${key}` } });
  const secondRegistration = await customerPage.request.post(`/api/demo/${workspaceId}/register`, { data: { brandSlug: brand.slug, productSlug: secondProduct.slug, serialNumber: `SPEAK-${key}` } });
  expect(firstRegistration.ok()).toBeTruthy();
  expect(secondRegistration.ok()).toBeTruthy();
  const firstUnitId = (await firstRegistration.json()).unitId;
  const secondUnitId = (await secondRegistration.json()).unitId;

  expect((await customerPage.request.post(`/api/demo/${workspaceId}/customer/claims`, { data: { unitId: firstUnitId, issueTitle: `Cooler issue ${key}`, description: "Customer reported a cooler problem.", issueTags: firstTags } })).ok()).toBeTruthy();
  expect((await customerPage.request.post(`/api/demo/${workspaceId}/customer/claims`, { data: { unitId: secondUnitId, issueTitle: `Speaker issue ${key}`, description: "Customer reported a speaker problem.", issueTags: secondTags } })).ok()).toBeTruthy();
  await customer.close();

  await page.goto(`/demo/${workspaceId}/brand/claims`);
  await expect(page.getByText(`Cooler issue ${key}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`Speaker issue ${key}`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(page.locator('button[aria-pressed]')).toHaveCount(12);

  await page.getByLabel("Product").selectOption(firstProduct.id);
  await expect(page).toHaveURL(new RegExp(`product=${firstProduct.id}`));
  await expect(page.locator('button[aria-pressed]')).toHaveCount(6);
  for (const tag of firstTags) await expect(page.getByRole("button", { name: tag, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^More/ })).toHaveCount(0);

  await page.getByRole("button", { name: "No cooling", exact: true }).click();
  await expect(page.getByText(`Cooler issue ${key}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`Speaker issue ${key}`, { exact: true })).toHaveCount(0);
  await expect(page.locator('button[aria-pressed]')).toHaveCount(6);

  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expect(page.locator('button[aria-pressed]')).toHaveCount(12);
  await page.getByRole("button", { name: "Battery", exact: true }).click();
  await expect(page.getByRole("button", { name: "Battery", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /^Filters/ })).toContainText("1");
  await expect(page.locator("tbody tr")).toHaveCount(1);
});
