import { dateOnly } from "../src/lib/dates";

export const MAX_REGISTRATION_DAYS = 3650;

export function parseRegistrationPolicy(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Choose a registration window.");
  const policy = value as Record<string, unknown>;
  const days = policy.registrationWindowDays;
  if (days !== null && (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > MAX_REGISTRATION_DAYS)) {
    throw new Error(`Enter a whole number of days between 1 and ${MAX_REGISTRATION_DAYS}.`);
  }
  if (policy.lateRegistrationAction !== "REJECT" && policy.lateRegistrationAction !== "MANUAL_REVIEW") {
    throw new Error("Choose how late registrations are handled.");
  }
  return { registrationWindowDays: days as number | null, lateRegistrationAction: policy.lateRegistrationAction as "REJECT" | "MANUAL_REVIEW" };
}

// Delivery and deadline are UTC calendar dates throughout the app. The final date is inclusive.
export function registrationDeadline(deliveredOn: Date, days: number): Date {
  const deadline = dateOnly(deliveredOn);
  deadline.setUTCDate(deadline.getUTCDate() + days);
  return deadline;
}

export function isLateRegistration(deliveredOn: Date, days: number, submittedAt = new Date()) {
  return dateOnly(submittedAt).getTime() > registrationDeadline(deliveredOn, days).getTime();
}
