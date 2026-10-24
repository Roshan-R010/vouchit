import type { ClaimStatus } from "@prisma/client";

export const claimStatusLabels: Record<ClaimStatus, string> = {
  SUBMITTED: "New",
  UNDER_REVIEW: "In review",
  INFO_REQUESTED: "Needs information",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RESOLVED: "Resolved",
};

export const claimStatusOptions = Object.keys(claimStatusLabels) as ClaimStatus[];

export function isClaimStatus(value: string): value is ClaimStatus {
  return Object.prototype.hasOwnProperty.call(claimStatusLabels, value);
}
