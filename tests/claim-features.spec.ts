import { expect, test } from "@playwright/test";
import { db } from "../src/lib/db";

const workspaces: string[] = [];
const testUsers: string[] = [];
test.afterEach(async () => {
  await db.demoSession.deleteMany({ where: { id: { in: workspaces } } });
  await db.account.deleteMany({ where: { username: { in: testUsers } } });
  await db.$disconnect();
});

test("login, templates, claim notes, costs, conflicts, and brand isolation", async ({ page, playwright }) => {
  const key = Math.random().toString(36).slice(2, 10);
  const password = `TestPass_${key}`;
  const username = `feature_${key}`;
  testUsers.push(username, `other_${key}`, `customer_${key}`);
  const signup = await page.request.post("/api/auth/signup", { data: { role: "BRAND", username, password, displayName: "Feature Test Brand" } });
  expect(signup.status()).toBe(201);
  const sessionId = (await signup.json()).account.demoSessionId as string;
  workspaces.push(sessionId);
  const brand = await db.brand.create({ data: { demoSessionId: sessionId, name: "Feature Brand", slug: `feature-${key}` } });
  const customer = await db.customer.create({ data: { demoSessionId: sessionId, name: "Test Customer", email: `customer-${key}@example.com` } });
  const product = await db.productModel.create({ data: { brandId: brand.id, name: "Test Product", slug: `product-${key}` } });
  const order = await db.purchaseOrder.create({ data: { brandId: brand.id, customerId: customer.id, orderNumber: `ORDER-${key}` } });
  async function claim(suffix: string) {
    const unit = await db.productUnit.create({ data: { brandId: brand.id, productModelId: product.id, purchaseOrderId: order.id, serialNumber: `UNIT-${key}-${suffix}` } });
    const registration = await db.warrantyRegistration.create({ data: { unitId: unit.id, customerId: customer.id, coverageStartsOn: new Date("2026-01-01"), coverageEndsOn: new Date("2027-01-01") } });
    return db.warrantyClaim.create({ data: { registrationId: registration.id, reference: `VCH-${key}-${suffix}`, issueTitle: `Test issue ${suffix}`, description: "Warranty test", status: "UNDER_REVIEW" } });
  }
  const approvalClaim = await claim("approve");
  const rejectionClaim = await claim("reject");
  const requestClaim = await claim("request");
  const detailRejectClaim = await claim("detail-reject");
  const detailInfoClaim = await claim("detail-info");

  await page.request.post("/api/auth/logout");
  await page.goto("/login/brand");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/demo/${sessionId}/brand$`));

  await page.goto(`/demo/${sessionId}/brand/settings`);
  const manager = page.locator("#claim-templates");
  async function addTemplate(name: string, category: string, body: string) {
    await manager.locator("#template-name").fill(name);
    await manager.locator("#template-category").selectOption(category);
    await manager.locator("#template-body").fill(body);
    await manager.getByRole("button", { name: "Save template" }).click();
    await expect(manager.getByText(name, { exact: true })).toBeVisible();
  }
  await addTemplate("Approval text", "APPROVE", "Approved template text");
  await addTemplate("Rejection text", "REJECT", "Rejected template text");
  await addTemplate("More info text", "REQUEST_INFO", "Please send more information");
  await page.reload();
  await expect(manager.getByText("Approval text", { exact: true })).toBeVisible();
  expect((await page.request.post(`/api/demo/${sessionId}/brand/claim-templates`, { data: { name: "Approval text", category: "APPROVE", body: "Duplicate" } })).status()).toBe(409);

  await page.goto(`/demo/${sessionId}/brand/claims/${approvalClaim.id}`);
  await expect(page.getByRole("tab", { name: "Claim Details" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Review & decision" })).toBeVisible();
  await page.getByRole("tab", { name: "Claim Details" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Resolution", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Claim Details" }).click();
  const approvalPicker = page.locator("#template-APPROVE");
  const approvalNote = page.getByPlaceholder("Add the review findings and next steps for the customer.");
  await approvalNote.fill("My own draft");
  page.once("dialog", dialog => dialog.accept());
  await approvalPicker.selectOption({ label: "Approval text" });
  await expect(approvalNote).toHaveValue("Approved template text");
  await approvalNote.fill("Approved template text, edited for this claim");
  await page.getByRole("button", { name: "Approve claim", exact: true }).click();
  await expect.poll(async () => (await db.warrantyClaim.findUnique({ where: { id: approvalClaim.id } }))?.status).toBe("APPROVED");
  const approvalEvents = await db.claimEvent.findMany({ where: { claimId: approvalClaim.id } });
  expect(approvalEvents.at(-1)?.note).toBe("Approved template text, edited for this claim");
  expect(await db.claimMessage.count({ where: { claimId: approvalClaim.id } })).toBe(0);

  await page.getByRole("tab", { name: "Resolution", exact: true }).click();
  await expect(page.getByRole("region", { name: "Resolution" })).toBeVisible();
  await page.getByRole("tab", { name: "Activity" }).click();
  await expect(page.getByText("Approved template text, edited for this claim")).toBeVisible();

  await page.getByRole("tab", { name: "Resolution Costs" }).click();
  const costs = page.getByRole("region", { name: "Resolution costs" });
  const costToggle = costs.getByRole("button", { name: /Resolution Costs/ });
  await expect(costToggle).toHaveAttribute("aria-expanded", "false");
  await expect(costToggle).toContainText("₹0.00");
  await costToggle.click();
  await expect(costs.getByText("No costs recorded. Add an expense to begin.")).toBeVisible();
  async function addDraft(name: string, amount: string, index: number) {
    await costs.getByRole("button", { name: "Add another expense" }).click();
    await costs.getByRole("textbox", { name: `Expense ${index} name` }).fill(name);
    await costs.getByRole("textbox", { name: `Expense ${index} amount (INR)` }).fill(amount);
  }
  await addDraft("Repair labor", "199.99", 1);
  await addDraft("Parts", "0.01", 2);
  await addDraft("Courier charge", "5.00", 3);
  await expect(costs.getByText("₹205.00")).toBeVisible();
  await costToggle.click();
  await expect(costToggle).toContainText("₹0.00");
  await expect(costToggle).toContainText("Unsaved changes");
  await page.getByRole("tab", { name: "Claim Details" }).click();
  await page.getByRole("tab", { name: "Resolution Costs" }).click();
  await costToggle.click();
  await expect(costs.getByRole("textbox", { name: "Expense 3 name" })).toHaveValue("Courier charge");
  await costs.getByRole("button", { name: "Save changes" }).click();
  await expect(costs.getByText("Cost changes saved.")).toBeVisible();
  await expect(costToggle).toContainText("₹205.00");
  await page.reload();
  await expect(page.getByRole("tab", { name: "Claim Details" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Resolution Costs" }).click();
  await expect(costToggle).toHaveAttribute("aria-expanded", "false");
  await expect(costToggle).toContainText("₹205.00");
  await costToggle.click();
  await costs.getByRole("textbox", { name: "Expense 1 name" }).fill("Workshop labor");
  await costs.getByRole("textbox", { name: "Expense 1 amount (INR)" }).fill("100.00");
  page.once("dialog", dialog => dialog.accept());
  await costs.getByRole("button", { name: "Remove expense 2" }).click();
  await costs.getByRole("button", { name: "Save changes" }).click();
  await expect(costToggle).toContainText("₹105.00");
  await page.reload();
  await page.getByRole("tab", { name: "Resolution Costs" }).click();
  await costToggle.click();
  await expect(costs.getByRole("textbox", { name: "Expense 1 name" })).toHaveValue("Workshop labor");
  await expect(costs.getByRole("textbox", { name: "Expense 2 name" })).toHaveValue("Courier charge");
  await costs.getByRole("button", { name: "Add another expense" }).click();
  await costs.getByRole("button", { name: "Remove expense 3" }).click();
  await expect(costs.getByRole("button", { name: "Save changes" })).toBeDisabled();

  const costResponse = await page.request.get(`/api/demo/${sessionId}/brand/claims/${approvalClaim.id}/costs`);
  const savedCosts = (await costResponse.json()).costs;
  const first = savedCosts[0];
  const batchUrl = `/api/demo/${sessionId}/brand/claims/${approvalClaim.id}/costs/batch`;
  expect((await page.request.put(batchUrl, { data: { upserts: [{ id: first.id, version: first.version, label: "Workshop labor", amount: "110.00" }], deletes: [] } })).status()).toBe(200);
  expect((await page.request.put(batchUrl, { data: { upserts: [{ id: first.id, version: first.version, label: "Stale", amount: "90.00" }], deletes: [] } })).status()).toBe(409);
  expect((await page.request.put(batchUrl, { data: { upserts: [], deletes: [{ id: first.id, version: first.version }] } })).status()).toBe(409);
  await costs.getByRole("textbox", { name: "Expense 1 name" }).fill("Draft kept after conflict");
  await costs.getByRole("button", { name: "Save changes" }).click();
  await expect(costs.getByText(/Costs changed elsewhere/)).toBeVisible();
  await expect(costs.getByRole("textbox", { name: "Expense 1 name" })).toHaveValue("Draft kept after conflict");
  page.once("dialog", dialog => dialog.accept());
  await costs.getByRole("button", { name: "Reload saved costs" }).click();
  await expect(costs.getByRole("textbox", { name: "Expense 1 name" })).toHaveValue("Workshop labor");
  expect((await page.request.post(`/api/demo/${sessionId}/brand/claims/${approvalClaim.id}/costs`, { data: { category: "OTHER", amount: "1.001", currency: "INR" } })).status()).toBe(400);
  expect((await page.request.post(`/api/demo/${sessionId}/brand/claims/${approvalClaim.id}/costs`, { data: { category: "OTHER", amount: "1", currency: "USD" } })).status()).toBe(400);
  expect((await page.request.put(`/api/demo/${sessionId}/brand/claims/${approvalClaim.id}/costs/batch`, { data: { upserts: [{ newId: crypto.randomUUID(), label: "Bad amount", amount: "-1.00" }], deletes: [] } })).status()).toBe(400);
  const atomic = await page.request.put(`/api/demo/${sessionId}/brand/claims/${approvalClaim.id}/costs/batch`, { data: { upserts: [{ id: first.id, version: first.version, label: "Stale edit", amount: "1.00" }, { newId: crypto.randomUUID(), label: "Should roll back", amount: "2.00" }], deletes: [] } });
  expect(atomic.status()).toBe(409);
  expect((await db.claimCost.count({ where: { claimId: approvalClaim.id } }))).toBe(2);
  await page.reload();
  await page.getByRole("tab", { name: "Resolution Costs" }).click();
  await expect(costToggle).toContainText("₹115.00");
  await db.warrantyClaim.update({ where: { id: approvalClaim.id }, data: { status: "RESOLVED" } });
  await page.reload();
  await page.getByRole("tab", { name: "Resolution Costs" }).click();
  await costToggle.click();
  await addDraft("Delayed shipping", "5.00", 3);
  await costs.getByRole("button", { name: "Save changes" }).click();
  await expect(costToggle).toContainText("₹120.00");
  expect((await db.warrantyClaim.findUnique({ where: { id: approvalClaim.id } }))?.status).toBe("RESOLVED");
  const legacy = await page.request.post(`/api/demo/${sessionId}/brand/claims/${approvalClaim.id}/costs`, { data: { category: "REPAIR_LABOR", amount: "1.25", note: "Original memo", currency: "INR" } });
  expect(legacy.status()).toBe(201);
  await page.reload();
  await page.getByRole("tab", { name: "Resolution Costs" }).click();
  await costToggle.click();
  await expect(costs.getByRole("textbox", { name: "Expense 4 name" })).toHaveValue("Repair labor");
  await expect(costs.getByText("Previous note: Original memo")).toBeVisible();

  await page.goto(`/demo/${sessionId}/brand/claims`);
  await page.getByRole("button", { name: `Open claim ${rejectionClaim.reference}`, exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Claim details" });
  await panel.getByRole("button", { name: "Reject", exact: true }).click();
  await panel.locator("#template-REJECT").selectOption({ label: "Rejection text" });
  await expect(panel.getByLabel("Reason for rejection")).toHaveValue("Rejected template text");
  await panel.getByLabel("Reason for rejection").fill("Rejected template text, edited");
  await panel.getByRole("button", { name: "Reject claim", exact: true }).click();
  await expect.poll(async () => (await db.warrantyClaim.findUnique({ where: { id: rejectionClaim.id } }))?.status).toBe("REJECTED");
  expect((await db.claimEvent.findFirst({ where: { claimId: rejectionClaim.id }, orderBy: { createdAt: "desc" } }))?.note).toBe("Rejected template text, edited");
  expect(await db.claimMessage.count({ where: { claimId: rejectionClaim.id } })).toBe(0);

  await panel.getByRole("button", { name: "Close claim details" }).click();
  await page.getByRole("button", { name: `Open claim ${requestClaim.reference}`, exact: true }).click();
  await panel.getByRole("button", { name: "Request info", exact: true }).click();
  await panel.locator("#template-REQUEST_INFO").selectOption({ label: "More info text" });
  await panel.getByLabel("What information do you need?").fill("Please send more information, edited");
  await panel.getByRole("button", { name: "Request information", exact: true }).click();
  await expect.poll(async () => (await db.claimMessage.findFirst({ where: { claimId: requestClaim.id } }))?.body).toBe("Please send more information, edited");

  await page.goto(`/demo/${sessionId}/brand/claims/${detailRejectClaim.id}`);
  await page.locator("select.vouch-select").first().click();
  await page.getByRole("listbox").getByRole("option", { name: "Reject claim" }).click();
  await expect(page.locator("#template-REJECT")).toBeVisible({ timeout: 10000 });
  await page.locator("#template-REJECT").selectOption({ label: "Rejection text" });
  await page.getByPlaceholder("Explain why this claim is not covered and reference the relevant warranty terms.").fill("Full detail rejection edited");
  await page.getByRole("button", { name: "Reject claim", exact: true }).click();
  await expect.poll(async () => (await db.warrantyClaim.findUnique({ where: { id: detailRejectClaim.id } }))?.status).toBe("REJECTED");
  expect((await db.claimEvent.findFirst({ where: { claimId: detailRejectClaim.id } }))?.note).toBe("Full detail rejection edited");
  expect(await db.claimMessage.count({ where: { claimId: detailRejectClaim.id } })).toBe(0);

  await page.goto(`/demo/${sessionId}/brand/claims/${detailInfoClaim.id}`);
  await page.locator("select.vouch-select").first().click();
  await page.getByRole("listbox").getByRole("option", { name: "Request information" }).click();
  await expect(page.locator("#template-REQUEST_INFO")).toBeVisible({ timeout: 10000 });
  await page.locator("#template-REQUEST_INFO").selectOption({ label: "More info text" });
  await page.getByPlaceholder("Tell the customer what information is needed to continue.").fill("Full detail information request edited");
  await page.getByRole("button", { name: "Request information", exact: true }).click();
  await expect.poll(async () => (await db.claimMessage.findFirst({ where: { claimId: detailInfoClaim.id } }))?.body).toBe("Full detail information request edited");
  await page.getByRole("tab", { name: "Activity" }).click();
  await expect(page.getByText("Full detail information request edited").first()).toBeVisible();

  const other = await playwright.request.newContext({ baseURL: "http://127.0.0.1:3000" });
  const otherSignup = await other.post("/api/auth/signup", { data: { role: "BRAND", username: `other_${key}`, password, displayName: "Other Brand" } });
  const otherSession = (await otherSignup.json()).account.demoSessionId as string;
  workspaces.push(otherSession);
  await db.brand.create({ data: { demoSessionId: otherSession, name: "Other Brand", slug: `other-${key}` } });
  expect((await other.get(`/api/demo/${sessionId}/brand/claims/${approvalClaim.id}/costs`)).status()).toBe(403);
  const templateId = (await (await page.request.get(`/api/demo/${sessionId}/brand/claim-templates`)).json()).templates[0].id;
  expect((await other.put(`/api/demo/${otherSession}/brand/claim-templates/${templateId}`, { data: { name: "Stolen", category: "APPROVE", body: "No" } })).status()).toBe(404);
  expect((await other.get(`/api/demo/${otherSession}/brand/claims/${approvalClaim.id}/costs`)).status()).toBe(404);
  await other.dispose();

  const customerAccount = await playwright.request.newContext({ baseURL: "http://127.0.0.1:3000" });
  const customerSignup = await customerAccount.post("/api/auth/signup", { data: { role: "CUSTOMER", username: `customer_${key}`, password, displayName: "Test Customer", email: customer.email } });
  expect(customerSignup.status()).toBe(201);
  await db.customer.update({ where: { id: customer.id }, data: { accountId: (await customerSignup.json()).account.id } });
  expect((await customerAccount.get(`/api/demo/${sessionId}/brand/claims/${approvalClaim.id}/costs`)).status()).toBe(403);
  const customerClaim = await customerAccount.get(`/api/demo/${sessionId}/customer/claims/${approvalClaim.id}`);
  expect(customerClaim.status()).toBe(200);
  expect(JSON.stringify(await customerClaim.json())).not.toContain("amountPaise");
  await customerAccount.dispose();

  await page.goto(`/demo/${sessionId}/brand/settings`);
  await manager.getByRole("button", { name: "Edit", exact: true }).first().click();
  await manager.locator("#template-name").fill("Approval text updated");
  await manager.getByRole("button", { name: "Save template" }).click();
  await expect(manager.getByText("Approval text updated", { exact: true })).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await manager.getByRole("button", { name: "Delete", exact: true }).first().click();
  await expect(manager.getByText("Approval text updated", { exact: true })).toHaveCount(0);
  expect((await db.claimEvent.findFirst({ where: { claimId: approvalClaim.id }, orderBy: { createdAt: "desc" } }))?.note).toBe("Approved template text, edited for this claim");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/demo/${sessionId}/brand/claims/${approvalClaim.id}`);
  await page.getByRole("tab", { name: "Resolution Costs" }).click();
  await costs.getByRole("button", { name: /Resolution Costs/ }).click();
  await expect(costs.getByRole("textbox", { name: "Expense 1 name" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
