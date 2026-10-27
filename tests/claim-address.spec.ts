import { expect, test } from "@playwright/test";

let workspaceId = "";
let usernames: string[] = [];

test.afterEach(async () => {
  if (!workspaceId) return;
  if (typeof process.loadEnvFile === "function") process.loadEnvFile();
  const { db } = await import("../src/lib/db");
  await db.demoSession.deleteMany({ where: { id: workspaceId } });
  await db.account.deleteMany({ where: { username: { in: usernames } } });
  await db.$disconnect();
  workspaceId = "";
  usernames = [];
});

test("approved claim requests an address and only its customer can provide it", async ({ playwright, baseURL }) => {
  const key = Math.random().toString(36).slice(2, 10);
  usernames = [`brand_addr_${key}`, `customer_addr_${key}`, `other_addr_${key}`];
  const brandApi = await playwright.request.newContext({ baseURL });
  const customerApi = await playwright.request.newContext({ baseURL });
  const otherApi = await playwright.request.newContext({ baseURL });
  try {
    const brandSignup = await brandApi.post("/api/auth/signup", { data: { role: "BRAND", username: usernames[0], password: `Pass_${key}_123`, displayName: `Brand owner ${key}` } });
    expect(brandSignup.status()).toBe(201);
    workspaceId = (await brandSignup.json()).account.demoSessionId;
    const setup = await brandApi.post(`/api/demo/${workspaceId}/brand/setup`, { data: { name: `Warranty brand ${key}` } });
    expect(setup.status()).toBe(201);
    const brand = (await setup.json()).brand;
    const serial = `ADDR-${key}`;
    const created = await brandApi.post(`/api/demo/${workspaceId}/brand/products`, { data: { name: `Item ${key}`, warrantyMonths: 36, serialNumber: serial, orderNumber: `ORDER-${key}`, deliveredOn: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10) } });
    expect(created.status()).toBe(200);
    const product = (await created.json()).product;

    const customerSignup = await customerApi.post("/api/auth/signup", { data: { role: "CUSTOMER", username: usernames[1], password: `Pass_${key}_123`, displayName: `Customer ${key}`, email: `${usernames[1]}@example.com` } });
    expect(customerSignup.status()).toBe(201);
    const registration = await customerApi.post(`/api/demo/${workspaceId}/register`, { data: { brandSlug: brand.slug, productSlug: product.slug, serialNumber: serial } });
    expect(registration.ok()).toBeTruthy();
    const customerDashboard = await (await customerApi.get(`/api/demo/${workspaceId}/customer`)).json();
    const unitId = customerDashboard.warranties[0].unitId;
    const submitted = await customerApi.post(`/api/demo/${workspaceId}/customer/claims`, { data: { unitId, issueTitle: "Stopped working", description: "Stopped working during normal use.", submissionId: crypto.randomUUID() } });
    expect(submitted.ok()).toBeTruthy();
    const claimId = (await submitted.json()).claimId;

    expect((await brandApi.post(`/api/demo/${workspaceId}/brand/claims/${claimId}/action`, { data: { decision: "review" } })).ok()).toBeTruthy();
    expect((await brandApi.post(`/api/demo/${workspaceId}/brand/claims/${claimId}/action`, { data: { decision: "approve", resolutionMethod: "REPLACEMENT" } })).ok()).toBeTruthy();
    const pending = (await (await brandApi.get(`/api/demo/${workspaceId}/brand/claims/${claimId}`)).json()).claim;
    expect(pending.addressRequest.requestedAt).toBeTruthy();
    expect(pending.addressRequest.receivedAt).toBeNull();
    expect(pending.resolutionMethod).toBe("REPLACEMENT");
    expect((await brandApi.post(`/api/demo/${workspaceId}/brand/claims/${claimId}/action`, { data: { decision: "resolve", resolutionMethod: "REPLACEMENT", note: "Replacement arranged." } })).status()).toBe(400);

    expect((await otherApi.post("/api/auth/signup", { data: { role: "CUSTOMER", username: usernames[2], password: `Pass_${key}_123`, displayName: `Other ${key}`, email: `${usernames[2]}@example.com` } })).status()).toBe(201);
    const address = { recipient: `Customer ${key}`, line1: "12 Test Lane", line2: "", city: "Pune", region: "Maharashtra", postalCode: "411001", country: "India", phone: "" };
    expect((await otherApi.post(`/api/demo/${workspaceId}/customer/claims/${claimId}/address`, { data: address })).status()).toBe(404);
    expect((await otherApi.get(`/api/demo/${workspaceId}/customer/claims/${claimId}`)).status()).toBe(404);
    expect((await customerApi.post(`/api/demo/${workspaceId}/customer/claims/${claimId}/address`, { data: address })).ok()).toBeTruthy();
    const received = (await (await brandApi.get(`/api/demo/${workspaceId}/brand/claims/${claimId}`)).json()).claim;
    expect(received.addressRequest.receivedAt).toBeTruthy();
    expect(received.addressRequest.line1).toBe(address.line1);
    expect((await brandApi.post(`/api/demo/${workspaceId}/brand/claims/${claimId}/action`, { data: { decision: "resolve", resolutionMethod: "REPLACEMENT", note: "Replacement arranged." } })).ok()).toBeTruthy();
  } finally {
    await brandApi.dispose(); await customerApi.dispose(); await otherApi.dispose();
  }
});
