import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

let workspaceId = "";
let username = "";
test.afterEach(async () => {
  if (typeof process.loadEnvFile === "function") process.loadEnvFile();
  const { db } = await import("../src/lib/db");
  if (workspaceId) await db.demoSession.deleteMany({ where: { id: workspaceId } });
  if (username) await db.account.deleteMany({ where: { username } });
  await db.$disconnect();
});

test("dashboard uses scoped records, working attention links and a responsive blue chart", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const suffix = randomUUID().slice(0, 8);
  username = `dashboard_${suffix}`;
  const signup = await page.request.post("/api/auth/signup", { data: { role: "BRAND", username, password: randomUUID(), displayName: "Dashboard check" } });
  expect(signup.ok()).toBeTruthy();
  workspaceId = (await signup.json()).account.demoSessionId;
  const setup = await page.request.post(`/api/demo/${workspaceId}/brand/setup`, { data: { name: `Dashboard check ${suffix}` } });
  expect(setup.ok()).toBeTruthy();
  const brand = (await setup.json()).brand;
  if (typeof process.loadEnvFile === "function") process.loadEnvFile();
  const { db } = await import("../src/lib/db");
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const day = (offset: number) => new Date(today.getTime() + offset * 86_400_000);
  const rows = await db.$transaction(async tx => {
    const product = await tx.productModel.create({ data: { brandId: brand.id, name: "Dashboard test product", slug: `product-${suffix}`, warrantyMonths: 36, imageUrl: "/images/jb-air-products.png#xywh=43,36,108,161" } });
    const owner = await tx.customer.create({ data: { demoSessionId: workspaceId, name: "Registered customer", email: `${suffix}@example.com` } });
    const incomplete = await tx.customer.create({ data: { demoSessionId: workspaceId, name: "Incomplete customer", email: "" } });
    const registrations = [];
    for (const [index, registeredOffset, expiryOffset] of [[0, -1, 20], [1, -45, -1], [2, 0, 60]]) {
      const order = await tx.purchaseOrder.create({ data: { brandId: brand.id, orderNumber: `CHECK-${index}`, deliveredOn: day(-100) } });
      const unit = await tx.productUnit.create({ data: { brandId: brand.id, productModelId: product.id, purchaseOrderId: order.id, serialNumber: `CHECK-${index}` } });
      registrations.push(await tx.warrantyRegistration.create({ data: { unitId: unit.id, customerId: index === 2 ? incomplete.id : owner.id, registeredAt: day(registeredOffset), coverageStartsOn: day(-100), coverageEndsOn: day(expiryOffset) } }));
    }
    await tx.warrantyClaim.create({ data: { registrationId: registrations[0].id, reference: `DASH-${suffix}`, issueTitle: "Review needed", description: "Dashboard integration check.", status: "SUBMITTED" } });
    return registrations;
  }, { timeout: 30_000 });

  const endpoint = `/api/demo/${workspaceId}/brand`;
  const response = await page.request.get(endpoint);
  expect(response.ok()).toBeTruthy();
  const result = await response.json();
  expect(result.metrics).toEqual({ totalRegistrations: 3, productsCount: 1, expiringSoonCount: 1, missingDetailsCount: 1, needsReviewCount: 1, openClaimsCount: 1 });
  expect(result.chartData).toHaveLength(30);
  expect(result.chartData.reduce((sum: number, item: { count: number }) => sum + item.count, 0)).toBe(2);
  expect(result.recentRegistrations.map((row: { id: string }) => row.id)).toEqual([rows[2].id, rows[0].id, rows[1].id]);
  const expiring = await (await page.request.get(`${endpoint}/registrations?filter=expiring`)).json();
  expect(expiring.registrations.map((row: { id: string }) => row.id)).toEqual([rows[0].id]);
  const missing = await (await page.request.get(`${endpoint}/registrations?filter=missing_details`)).json();
  expect(missing.registrations.map((row: { id: string }) => row.id)).toEqual([rows[2].id]);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/demo/${workspaceId}/brand`);
  await expect(page.getByRole("heading", { name: /Dashboard check/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Warranty summary" }).getByRole("link")).toHaveCount(4);
  await expect(page.locator("[data-registration-line]")).toHaveAttribute("stroke", "#729cf2");
  await expect(page.locator("[data-registration-line]")).toHaveAttribute("d", /C /);
  await expect(page.getByRole("img", { name: "Warranty registrations over the last 30 days" }).locator("circle")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Warranty summary" }).locator("svg").first()).toHaveCSS("color", "rgb(17, 17, 17)");
  await expect(page.getByRole("region", { name: "Recent registrations" }).locator("tbody tr")).toHaveCount(3);
  const chartBox = await page.getByRole("region", { name: "Warranty overview" }).boundingBox();
  const attentionBox = await page.getByRole("region", { name: "Needs your attention" }).boundingBox();
  expect(Math.abs(chartBox!.y - attentionBox!.y)).toBeLessThan(2);
  await page.screenshot({ path: testInfo.outputPath("dashboard-desktop.png"), fullPage: true });
  await page.getByLabel("Warranty overview period").selectOption("90");
  await expect(page.getByText("3 registrations in the last 90 days", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "View warranties", exact: true }).click();
  await expect(page).toHaveURL(/filter=expiring/);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.goto(`/demo/${workspaceId}/brand`);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Recent registrations" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath("dashboard-mobile.png"), fullPage: true });
});
