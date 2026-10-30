import { expect, test } from "@playwright/test";

const sessionId = "11111111-1111-4111-8111-111111111111";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ json: route.request().url().endsWith("/auth/me")
    ? { account: { id: "owner", role: "BRAND", displayName: "Owner", demoSessionId: sessionId } }
    : { brand: { name: "Test Brand", logoUrl: null }, products: [], claims: [], counts: {} } }));
});

test("shared dropdown preserves values, keyboard controls and rounded blue styling", async ({ page }) => {
  await page.goto(`/demo/${sessionId}/brand/products/new`);
  const photo = page.getByRole("combobox", { name: "Maximum photos per claim", exact: true });
  await photo.click();
  const menu = page.getByRole("listbox");
  await expect(menu).toHaveCSS("border-radius", "10px");
  await expect(menu.getByRole("option", { selected: true })).toHaveCSS("background-color", "rgb(219, 234, 254)");
  await menu.getByRole("option", { name: "2 photos", exact: true }).click();
  await expect(photo).toHaveValue("2");
  await expect(photo).toBeFocused();
  await photo.press("ArrowDown");
  await photo.press("Home");
  await photo.press("Enter");
  await expect(photo).toHaveValue("1");
  await photo.click();
  await photo.press("ArrowDown");
  await photo.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(photo).toHaveValue("1");
  await photo.click();
  await photo.press("Tab");
  await expect(menu).toHaveCount(0);
  const verification = page.locator("select").first();
  await verification.click();
  await menu.getByRole("option", { name: "Order ID and Unit ID", exact: true }).click();
  await expect(verification).toHaveValue("ORDER_AND_UNIT");
});

test("catalog and claims filters keep their existing behavior", async ({ page }) => {
  await page.goto(`/demo/${sessionId}/brand/products`);
  const filter = page.getByRole("combobox", { name: "Filter products" });
  await filter.click();
  await page.getByRole("listbox").getByRole("option", { name: "No units yet", exact: true }).click();
  await expect(filter).toHaveValue("empty");
  await page.goto(`/demo/${sessionId}/brand/claims`);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const status = page.getByRole("combobox", { name: "Status", exact: true });
  await status.click();
  await page.getByRole("listbox").getByRole("option", { name: "Needs info", exact: true }).click();
  await expect(page).toHaveURL(/status=INFO_REQUESTED/);
  await expect(status).toHaveValue("INFO_REQUESTED");
});
