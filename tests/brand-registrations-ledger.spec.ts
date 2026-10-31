import { expect, test, type Page } from "@playwright/test";

const sessionId = "11111111-1111-4111-8111-111111111111";
const path = `/demo/${sessionId}/brand/registrations`;
const products = [
  { id: "11111111-1111-4111-8111-111111111112", name: "AIR400" },
  { id: "11111111-1111-4111-8111-111111111113", name: "AIR600" },
  { id: "11111111-1111-4111-8111-111111111114", name: "AIR800" },
];
const today = new Date();
const dateAt = (days: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + days)).toISOString();
const registrations = Array.from({ length: 12 }, (_, index) => ({
  id: `registration-${index}`, registeredAt: dateAt(-index), coverageStartsOn: dateAt(-365),
  coverageEndsOn: dateAt(index === 1 ? -1 : index === 0 ? 10 : 365),
  customer: { name: index === 0 ? "Roshan" : `Customer ${index}`, email: index === 0 ? "roshan@example.com" : `customer${index}@example.com` },
  unit: { serialNumber: `JB-${String(index + 41).padStart(5, "0")}`, productModel: { ...products[index >= 10 ? 1 : 0], imageUrl: null }, purchaseOrder: { orderNumber: `ORD-${String(index + 1041).padStart(5, "0")}` } },
  claim: index === 0 ? { id: "claim-1", reference: "VCH-AA604123456789", status: "UNDER_REVIEW" } : null,
}));

async function mockApi(page: Page) {
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") return route.fulfill({ json: { account: { id: "owner", role: "BRAND", displayName: "Arun", demoSessionId: sessionId } } });
    if (url.pathname.endsWith("/brand/settings")) return route.fulfill({ json: { brand: { name: "JB Air", logoUrl: null } } });
    if (url.pathname.endsWith("/brand/registrations")) {
      const product = url.searchParams.get("product");
      const status = url.searchParams.get("status");
      const search = url.searchParams.get("search")?.toLowerCase();
      const rows = registrations.filter(item => (!product || item.unit.productModel.id === product)
        && (!status || (status === "expired" ? item.coverageEndsOn < dateAt(0) : status === "expiring" ? item.coverageEndsOn >= dateAt(0) && item.coverageEndsOn <= dateAt(30) : item.coverageEndsOn >= dateAt(0)))
        && (!search || `${item.unit.serialNumber} ${item.unit.purchaseOrder.orderNumber} ${item.customer.name} ${item.customer.email}`.toLowerCase().includes(search)));
      const pageNumber = Math.min(Number(url.searchParams.get("page")) || 1, Math.max(1, Math.ceil(rows.length / 10)));
      return route.fulfill({ json: { registrations: rows.slice((pageNumber - 1) * 10, pageNumber * 10), products, total: rows.length, page: pageNumber, pageSize: 10 } });
    }
    return route.fulfill({ json: {} });
  });
}

test("registration ledger searches, filters, pages, and opens linked details", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`http://localhost:3000${path}`);
  await expect(page.getByRole("heading", { name: "Warranty Registrations" })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(10);
  await expect(page.getByText("12 registrations", { exact: true })).toBeVisible();
  await page.screenshot({ path: ".vouch/registrations-list-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.getByRole("combobox", { name: "Product" }).selectOption(products[1].id);
  await expect(page.getByText("2 registrations", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Product" }).selectOption(products[2].id);
  await expect(page.getByText("No registrations for this product")).toBeVisible();
  await page.getByRole("combobox", { name: "Product" }).selectOption(products[0].id);
  await page.getByRole("searchbox", { name: "Search registrations" }).fill("Roshan");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByText("1 registration", { exact: true })).toBeVisible();
  await page.screenshot({ path: ".vouch/registrations-desktop.png", fullPage: true });
  await page.locator("tbody tr").first().click();
  const drawer = page.getByRole("dialog", { name: /Registration details/ });
  await expect(drawer.getByText("ORD-01041")).toBeVisible();
  await expect(drawer.getByText("roshan@example.com")).toBeVisible();
  await expect(drawer.getByRole("link", { name: "View claim" })).toHaveAttribute("href", `/demo/${sessionId}/brand/claims/claim-1`);
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(page.locator("tbody tr").first()).toBeFocused();
  for (const term of ["JB-00041", "roshan@example.com"]) {
    await page.getByRole("searchbox", { name: "Search registrations" }).fill(term);
    await expect.poll(() => new URL(page.url()).searchParams.get("search")).toBe(term);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr").first()).toContainText("JB-00041");
  }
  await page.getByRole("searchbox", { name: "Search registrations" }).fill("ORD-01042");
  await expect.poll(() => new URL(page.url()).searchParams.get("search")).toBe("ORD-01042");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("combobox", { name: "Warranty status" }).selectOption("expired");
  await expect(page.getByText("Expired", { exact: true }).last()).toBeVisible();
  await page.getByRole("searchbox", { name: "Search registrations" }).fill("no-such-unit");
  await expect(page.getByText("No matching registrations")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByText("12 registrations", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Close navigation" }).click({ position: { x: 370, y: 300 } });
  await expect.poll(() => page.locator(".brand-rail-sidebar").evaluate(element => Math.round(element.getBoundingClientRect().width))).toBe(66);
  await page.screenshot({ path: ".vouch/registrations-mobile.png", fullPage: true });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
