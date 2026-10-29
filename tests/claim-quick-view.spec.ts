import { expect, test, type Page } from "@playwright/test";

const sessionId = "11111111-1111-4111-8111-111111111111";
const path = `/demo/${sessionId}/brand/claims`;
async function mockClaims(page: Page) {
  const actions: any[] = [];
  const names = ["Sarah Mitchell", "Daniel Kim", "Priya Shah", "Marcus Lee", "Emily Carter", "James Wilson", "Olivia Martinez", "Noah Thompson", "Ava Hernandez", "Liam Davis", "Mia Green", "Leo Brown"];
  const states = ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED", "APPROVED", "REJECTED", "RESOLVED"];
  const claims: any[] = names.map((name, index) => ({
    id: `claim-${index + 1}`, reference: `CLM-${10432 - index}`, status: states[index % states.length],
    issueTitle: ["Won’t power on", "Cracked display", "Battery not charging"][index % 3],
    description: "The device won’t power on. I have tried multiple chargers and outlets but still no response. It worked fine for about six months.",
    submittedAt: new Date(Date.UTC(2026, 9, 28 - index, 8, 45)).toISOString(), issueTags: ["Power failure"],
    registration: { customer: { name, email: `customer${index}@example.test` }, coverageEndsOn: "2029-10-02T00:00:00Z", unit: { serialNumber: `TF23-${index}-AL`, productModelId: "product-1", productModel: { name: "AIR400", imageUrl: "/images/jb-air-products.png#xywh=43,36,108,161", sku: "AIR400" }, purchaseOrder: { orderNumber: `ACM-${771903 + index}` } } },
    events: [{ id: `event-${index}`, actor: "CUSTOMER", note: "Warranty claim submitted.", createdAt: "2026-10-28T08:45:00Z", toStatus: "SUBMITTED" }],
    attachments: [], messages: [], addressRequest: null, resolutionMethod: index === 3 ? "REPAIR" : null,
  }));
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const id = url.pathname.match(/\/claims\/(claim-\d+)/)?.[1];
    const claim = claims.find(row => row.id === id);
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON(); actions.push(body);
      if (!claim) return route.fulfill({ status: 404, json: { error: "Not found" } });
      if (url.pathname.endsWith("request-address")) { claim.addressRequest = { requestedAt: new Date().toISOString(), receivedAt: null }; claim.resolutionMethod = body.resolutionMethod; return route.fulfill({ json: { success: true } }); }
      const transitions: Record<string, [string, string]> = { review: ["SUBMITTED", "UNDER_REVIEW"], request_info: ["UNDER_REVIEW", "INFO_REQUESTED"], approve: ["UNDER_REVIEW", "APPROVED"], reject: ["UNDER_REVIEW", "REJECTED"], resolve: ["APPROVED", "RESOLVED"] };
      const transition = transitions[body.decision];
      if (!transition || claim.status !== transition[0]) return route.fulfill({ status: 400, json: { error: "Claim status changed. Refresh before trying again." } });
      if (body.decision === "resolve" && !claim.addressRequest?.receivedAt) return route.fulfill({ status: 400, json: { error: "An address is required." } });
      claim.status = transition[1];
      if (body.resolutionMethod) claim.resolutionMethod = body.resolutionMethod;
      if (body.decision === "approve") claim.addressRequest = { requestedAt: new Date().toISOString(), receivedAt: null };
      if (body.decision === "request_info") claim.messages.push({ id: "question", author: "BRAND", body: body.note, createdAt: new Date().toISOString() });
      claim.events.push({ id: `action-${actions.length}`, actor: "BRAND", note: body.note || `Claim ${claim.status.toLowerCase()}.`, createdAt: new Date().toISOString(), toStatus: claim.status });
      return route.fulfill({ json: { success: true, message: "Claim updated successfully." } });
    }
    if (url.pathname === "/api/auth/me") return route.fulfill({ json: { account: { id: "owner", role: "BRAND", displayName: "John Smith", demoSessionId: sessionId } } });
    if (url.pathname.endsWith("/brand/settings")) return route.fulfill({ json: { brand: { name: "Acme Hardware", logoUrl: null } } });
    if (claim) return route.fulfill({ json: { claim } });
    if (url.pathname.endsWith("/brand/claims")) {
      const status = url.searchParams.get("status");
      const search = url.searchParams.get("search")?.toLowerCase();
      const rows = claims.filter(row => (!status || (status === "open" ? ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"].includes(row.status) : row.status === ({ needs_review: "SUBMITTED", in_review: "UNDER_REVIEW", rejected: "REJECTED" }[status] || status))) && (!search || `${row.reference} ${row.registration.customer.name} ${row.registration.unit.purchaseOrder.orderNumber}`.toLowerCase().includes(search)));
      return route.fulfill({ json: { claims: rows.map(row => ({ ...row, customer: row.registration.customer, unit: { ...row.registration.unit, productModel: row.registration.unit.productModel.name } })), products: [{ id: "product-1", name: "AIR400", issueTags: ["Power failure", "Battery"] }], counts: { all: claims.length, open: claims.filter(row => ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"].includes(row.status)).length, approved: claims.filter(row => row.status === "APPROVED").length, rejected: claims.filter(row => row.status === "REJECTED").length } } });
    }
    return route.fulfill({ json: {} });
  });
  return { claims, actions };
}

test("claims layout groups filters, paginates, and opens a responsive panel", async ({ page }) => {
  const { claims } = await mockClaims(page);
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto(path);
  await expect(page.locator("tbody tr")).toHaveCount(10);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Claim filters" })).toHaveCount(0);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Product", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Power failure", exact: true }).click();
  await expect(page).toHaveURL(/tag=Power/);
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.getByRole("button", { name: "Previous page", exact: true }).click();
  await page.getByRole("button", { name: "Open claim CLM-10432", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Claim details" });
  await expect(panel.getByRole("heading", { name: "CLM-10432" })).toBeVisible();
  await expect(panel.getByText("Sarah Mitchell", { exact: true }).first()).toBeVisible();
  await expect(panel.locator("details").first()).not.toHaveAttribute("open", "");
  await expect(panel.getByRole("link", { name: "Open full claim", exact: true }).first()).toHaveAttribute("href", `${path}/claim-1`);
  await expect.poll(() => panel.evaluate(element => getComputedStyle(element).transform)).toBe("none");
  await page.screenshot({ path: ".vouch/claims-desktop.png", fullPage: true });
  await panel.getByRole("button", { name: "Close claim details" }).click();
  await expect(panel).toHaveCount(0);
  claims[0].reference = "VCH-AC01781F2BB041E99DB49A1066058E5A";
  await page.reload();
  await page.getByRole("button", { name: `Open claim ${claims[0].reference}`, exact: true }).click();
  await expect(panel.getByRole("heading", { name: claims[0].reference })).toBeVisible();
  await expect(panel.getByRole("heading", { name: claims[0].reference })).toHaveText("VCH-AC0178…");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel.getByRole("button", { name: "Start review" })).toBeVisible();
  await expect.poll(() => panel.evaluate(element => getComputedStyle(element).transform)).toBe("none");
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBeTruthy();
  await page.screenshot({ path: ".vouch/claims-mobile.png", fullPage: true });
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});

test("brand completes review, information request, approval and resolution inside panel", async ({ page }) => {
  const { claims, actions } = await mockClaims(page);
  await page.goto(path);
  await page.getByRole("button", { name: "Open claim CLM-10432", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Claim details" });
  await panel.getByRole("button", { name: "Start review", exact: true }).click();
  await panel.getByRole("button", { name: "Request info", exact: true }).click();
  await panel.getByLabel("What information do you need?").fill("Please confirm which charger you used.");
  await panel.getByRole("button", { name: "Request information", exact: true }).click();
  await expect(panel.getByText("Needs info", { exact: true })).toBeVisible();
  claims[0].status = "UNDER_REVIEW";
  claims[0].messages.push({ id: "reply", author: "CUSTOMER", body: "I used the original charger.", createdAt: new Date().toISOString() });
  await panel.getByRole("button", { name: "Refresh claim" }).click();
  await panel.getByRole("button", { name: "Approve", exact: true }).click();
  await panel.getByLabel("Resolution method").selectOption("REPLACEMENT");
  await panel.getByRole("button", { name: "Approve claim", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Mark as resolved", exact: true })).toBeDisabled();
  claims[0].addressRequest = { receivedAt: new Date().toISOString(), recipient: "Sarah Mitchell", line1: "123 Example Street", city: "Chennai", region: "Tamil Nadu", postalCode: "600001", country: "India", phone: "+910000000000" };
  await panel.getByRole("button", { name: "Refresh claim" }).click();
  await panel.locator("summary").filter({ hasText: "Address details" }).click();
  await expect(panel.getByText("123 Example Street", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Mark as resolved", exact: true }).click();
  await expect(panel.getByLabel("Resolution method")).toBeDisabled();
  await panel.getByLabel("Repair or replacement outcome").fill("Replacement delivered to the customer.");
  await panel.getByRole("button", { name: "Mark as resolved", exact: true }).last().click();
  await expect(panel.getByText("This claim is resolved.")).toBeVisible();
  expect(actions.map(action => action.decision)).toEqual(["review", "request_info", "approve", "resolve"]);
  expect(actions.at(-1).resolutionMethod).toBe("REPLACEMENT");
  await expect(page).toHaveURL(path);
});

test("panel rejects with a reason and requests addresses for older approved claims", async ({ page }) => {
  const { actions } = await mockClaims(page);
  await page.goto(path);
  await page.getByRole("button", { name: "Open claim CLM-10431", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Claim details" });
  await panel.getByRole("button", { name: "Reject", exact: true }).click();
  await panel.getByLabel("Reason for rejection").fill("Damage is outside the warranty terms.");
  await panel.getByRole("button", { name: "Reject claim", exact: true }).click();
  await expect(panel.getByText("This claim is closed.", { exact: false })).toBeVisible();
  await panel.getByRole("button", { name: "Close claim details" }).click();
  await page.getByRole("button", { name: "Open claim CLM-10429", exact: true }).click();
  await panel.getByRole("button", { name: "Request address", exact: true }).click();
  await panel.getByRole("button", { name: "Request customer address", exact: true }).click();
  await expect(panel.getByText("Awaiting customer", { exact: true })).toBeVisible();
  expect(actions.map(action => action.decision)).toEqual(["reject", "request_address"]);
});
