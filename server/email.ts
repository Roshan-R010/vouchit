import { db } from "../src/lib/db";
import { daysRemaining } from "../src/lib/dates";

export function registrationEmail(product: string, brand: string, coverageEndsOn: Date) {
  const days = daysRemaining(coverageEndsOn);
  return {
    subject: "Your warranty registration is complete",
    body: `Your warranty registration for ${product} from ${brand} has been completed successfully.\n\nYour warranty has ${days} ${days === 1 ? "day" : "days"} remaining as of registration.\n\nVouch`,
  };
}

let running = false;
export async function processEmailQueue(client: Pick<typeof db, "emailOutbox"> = db) {
  if (running || !process.env.RESEND_API_KEY) return;
  running = true;
  try {
    // Each database claim leases a job, allowing multiple API instances safely.
    for (let count = 0; count < 10; count++) {
      const now = new Date();
      const job = await client.emailOutbox.findFirst({
        where: { status: { in: ["PENDING", "SENDING"] }, availableAt: { lte: now } },
        orderBy: { createdAt: "asc" },
      });
      if (!job) break;
      const leaseUntil = new Date(now.getTime() + 60_000);
      const claimed = await client.emailOutbox.updateMany({
        where: { id: job.id, status: job.status, attempts: job.attempts, availableAt: { lte: now } },
        data: { status: "SENDING", availableAt: leaseUntil, attempts: { increment: 1 }, firstAttemptAt: job.firstAttemptAt ?? now },
      });
      if (!claimed.count) continue;
      // Resend retains deduplication keys for 24 hours. Ambiguous old sends
      // need manual review rather than risking a second confirmation.
      if (job.attempts >= 8 || (job.firstAttemptAt && now.getTime() - job.firstAttemptAt.getTime() >= 23 * 60 * 60 * 1000)) {
        await client.emailOutbox.update({ where: { id: job.id }, data: { status: "FAILED", lastError: "Retry window expired; review delivery before resending." } });
        continue;
      }
      let retryable = true;
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": job.eventKey },
          body: JSON.stringify({ from: job.sender, to: [job.recipient], subject: job.subject, text: job.body }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
          retryable = response.status === 429 || response.status === 409 || response.status >= 500;
          throw new Error(`Resend returned HTTP ${response.status}`);
        }
        const result = await response.json() as { id?: string };
        if (!result.id) throw new Error("Resend response did not include an email ID");
        await client.emailOutbox.update({ where: { id: job.id }, data: { status: "ACCEPTED", acceptedAt: new Date(), providerId: result.id, lastError: null } });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Email request failed";
        await client.emailOutbox.update({ where: { id: job.id }, data: {
          status: retryable && job.attempts + 1 < 8 ? "PENDING" : "FAILED",
          availableAt: new Date(Date.now() + Math.min(60_000 * 2 ** job.attempts, 3_600_000)),
          lastError: message,
        } });
        console.error(`[Email] Job ${job.id}: ${message}`);
      }
      // Stay below the provider's default request rate across a batch.
      await new Promise(resolve => setTimeout(resolve, 600));
    }
  } finally {
    running = false;
  }
}

export function startEmailWorker() {
  const tick = () => { void processEmailQueue().catch(() => console.error("[Email] Could not process email queue. Check database migration and connectivity.")); };
  tick();
  const timer = setInterval(tick, 15_000);
  timer.unref();
}
