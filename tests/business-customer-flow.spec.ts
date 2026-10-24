import { expect, test } from "@playwright/test";

test("business product, registration, warranty card and claim stay connected", async ({ page }) => {
  const suffix = Date.now().toString().slice(-7);
  const productName = `Orbit Buds ${suffix}`;
  const serial = `ORB-${suffix}`;
  const order = `ORD-${suffix}`;

  await page.goto("/demo?view=brand");
  await expect(page).toHaveURL(/\/demo\/[0-9a-f-]{36}\/brand$/);
  const brandUrl = new URL(page.url());
  const sessionId = brandUrl.pathname.split("/")[2];
  const brandBase = `/demo/${sessionId}/brand`;

  await page.goto(`${brandBase}/products/new`);
  await page.getByLabel("Product name").fill(productName);
  await page.getByLabel(/SKU/).fill(`ORB-${suffix}`);
  await page.getByLabel("Warranty duration").fill("18");
  await page.locator('input[name="image"]').setInputFiles({
    name: "orbit.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  });
  await page.getByLabel("Stamped unit ID").fill(serial);
  await page.getByLabel("Order reference").fill(order);
  await page.getByLabel("Delivery date").fill("2026-10-20");
  await page.getByRole("button", { name: "Create product & link" }).click();
  await expect(page).toHaveURL(new RegExp(`${brandBase}/products/[0-9a-f-]{36}\\?created=1$`));
  await expect(page.getByRole("heading", { level: 1, name: productName })).toBeVisible();
  await expect(page.locator(".business-product-overview img")).toHaveAttribute("src", /product-images/);
  const registrationUrl = await page.getByLabel("Registration link").inputValue();
  expect(registrationUrl).toContain(`/demo/${sessionId}/register/`);

  await page.goto(registrationUrl);
  await expect(page.getByText(productName, { exact: true })).toBeVisible();
  await page.getByLabel("Unit ID").fill(serial);
  await page.getByRole("button", { name: "Check unit" }).click();
  await expect(page.getByText("Unit matched to your product")).toBeVisible();
  await expect(page.getByText(order, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Register warranty" }).click();
  await expect(page).toHaveURL(new RegExp(`/demo/${sessionId}/customer/products/[0-9a-f-]{36}\\?notice=registered$`));
  await expect(page.getByText("18 months from delivery")).toBeVisible();
  await expect(page.locator(`img[alt="${productName}"]`)).toBeVisible();

  await page.getByRole("link", { name: "Raise a claim" }).click();
  await page.getByLabel("What’s the issue?").fill(`Charging issue ${suffix}`);
  await page.getByLabel("Tell us a little more").fill("The case no longer charges after normal use.");
  await page.getByRole("button", { name: "Submit claim" }).click();
  await expect(page).toHaveURL(new RegExp(`/demo/${sessionId}/customer/claims/[0-9a-f-]{36}$`));
  const trackingUrl = page.url();
  await expect(page.getByText("Submitted", { exact: true }).first()).toBeVisible();

  await page.goto(`${brandBase}/claims`);
  await page.getByRole("link", { name: new RegExp(`Charging issue ${suffix}`) }).click();
  await page.getByRole("button", { name: "Mark in review" }).click();
  await expect(page.getByText(/Claim updated/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Approve claim" }).click();
  await expect(page.getByText(/Claim updated/)).toBeVisible();

  await page.goto(trackingUrl);
  await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();
});
