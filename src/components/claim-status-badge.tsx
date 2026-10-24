export const claimStatusLabels: Record<string, string> = {
  SUBMITTED: "Submitted", UNDER_REVIEW: "Under review", INFO_REQUESTED: "Information requested",
  APPROVED: "Approved", REJECTED: "Rejected", RESOLVED: "Resolved",
};
export function ClaimStatusBadge({ status }: { status: string }) {
  return <span className={`claim-status claim-status-${status.toLowerCase()}`}><span aria-hidden="true"/>{claimStatusLabels[status] || "Status unavailable"}</span>;
}
