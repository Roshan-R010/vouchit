import styles from "./claim-evidence.module.css";

type Attachment = { id: string };

export function ClaimEvidence({ sessionId, claimId, attachments, compact = false }: { sessionId: string; claimId: string; attachments: Attachment[]; compact?: boolean }) {
  if (!attachments.length) return <p className={styles.empty}>No photos attached to this claim.</p>;
  return <div className={compact ? styles.compact : styles.grid}>
    {attachments.map((attachment, index) => {
      const url = `/api/demo/${sessionId}/claim-photos/${claimId}/${attachment.id}`;
      return <a key={attachment.id} href={url} target="_blank" rel="noreferrer" aria-label={`Open claim photo ${index + 1} in full size`} title="Open full size photo"><img src={url} alt={`Claim evidence ${index + 1}`} loading="lazy"/><span>Photo {index + 1}</span></a>;
    })}
  </div>;
}
