import styles from "./claim-inbox-status.module.css";
export const inboxStatusLabels: Record<string, string> = {
  SUBMITTED: "Needs review", UNDER_REVIEW: "In progress", INFO_REQUESTED: "Needs info",
  APPROVED: "Approved", REJECTED: "Rejected", RESOLVED: "Resolved",
};
export function ClaimInboxStatus({ status }: { status: string }) {
  return <span className={styles.badge} data-status={status}>{inboxStatusLabels[status] || status}</span>;
}
