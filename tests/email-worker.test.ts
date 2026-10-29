import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
const client: any = { emailOutbox: { findFirst() {}, updateMany() {}, update() {} } };
import { dateOnly } from "../src/lib/dates";
import { processEmailQueue, registrationEmail } from "../server/email";

const originalKey = process.env.RESEND_API_KEY;
afterEach(() => {
  mock.restoreAll();
  if (originalKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalKey;
});

function queue(overrides: Record<string, unknown> = {}, claimCount = 1) {
  process.env.RESEND_API_KEY = "test-only-key";
  const job = {
    id: "test-job", eventKey: "warranty-registered/test-registration",
    sender: "Vouch <onboarding@resend.dev>", recipient: "customer@example.com",
    subject: "Warranty registered", body: "Product and brand confirmation",
    status: "PENDING", attempts: 0, availableAt: new Date(), firstAttemptAt: null,
    ...overrides,
  };
  let read = false;
  const updates: any[] = [];
  mock.method(client.emailOutbox, "findFirst", async () => { if (read) return null; read = true; return job; });
  mock.method(client.emailOutbox, "updateMany", async () => ({ count: claimCount }));
  mock.method(client.emailOutbox, "update", async (args: any) => { updates.push(args.data); return job; });
  return { job, updates };
}

test("confirmation uses remaining coverage and handles expired coverage", () => {
  const tomorrow = dateOnly(new Date());
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const email = registrationEmail("Headphones", "Example Brand", tomorrow);
  assert.match(email.body, /Headphones from Example Brand/);
  assert.match(email.body, /1 day remaining/);
  assert.match(registrationEmail("Product", "Brand", new Date("2000-01-01")).body, /0 days remaining/);
});

test("sends the saved recipient and payload with a stable idempotency key", async () => {
  const { job, updates } = queue();
  const send = mock.method(globalThis, "fetch", async (_url, options: RequestInit) => {
    assert.equal((options.headers as Record<string, string>)["Idempotency-Key"], job.eventKey);
    assert.deepEqual(JSON.parse(String(options.body)), { from: job.sender, to: [job.recipient], subject: job.subject, text: job.body });
    return Response.json({ id: "resend-email-id" });
  });
  await processEmailQueue(client);
  assert.equal(send.mock.callCount(), 1);
  assert.equal(updates[0].status, "ACCEPTED");
  assert.equal(updates[0].providerId, "resend-email-id");
});

test("rate limiting retries later without marking the message accepted", async () => {
  const { updates } = queue();
  mock.method(globalThis, "fetch", async () => new Response("rate limited", { status: 429 }));
  await processEmailQueue(client);
  assert.equal(updates[0].status, "PENDING");
  assert.ok(updates[0].availableAt > new Date());
});

test("a rejected recipient is marked failed rather than retried indefinitely", async () => {
  const { updates } = queue();
  mock.method(globalThis, "fetch", async () => new Response("forbidden", { status: 403 }));
  await processEmailQueue(client);
  assert.equal(updates[0].status, "FAILED");
});

test("a job claimed by another worker is not sent", async () => {
  queue({}, 0);
  const send = mock.method(globalThis, "fetch", async () => { throw new Error("Must not send"); });
  await processEmailQueue(client);
  assert.equal(send.mock.callCount(), 0);
});

test("an uncertain send outside the deduplication window needs review", async () => {
  const { updates } = queue({ attempts: 1, firstAttemptAt: new Date(Date.now() - 24 * 60 * 60 * 1000) });
  const send = mock.method(globalThis, "fetch", async () => { throw new Error("Must not send"); });
  await processEmailQueue(client);
  assert.equal(send.mock.callCount(), 0);
  assert.equal(updates[0].status, "FAILED");
});

test("without an API key queued mail stays untouched", async () => {
  delete process.env.RESEND_API_KEY;
  const read = mock.method(client.emailOutbox, "findFirst", async () => { throw new Error("Must not read"); });
  await processEmailQueue(client);
  assert.equal(read.mock.callCount(), 0);
});
