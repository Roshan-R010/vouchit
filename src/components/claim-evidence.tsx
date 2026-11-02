import styles from "./claim-evidence.module.css";
import { ClaimPhotoGallery } from "./claim-photo-gallery";

type Attachment = { id: string };

export function ClaimEvidence({ sessionId, claimId, attachments, compact = false }: { sessionId: string; claimId: string; attachments: Attachment[]; compact?: boolean }) {
  if (!attachments.length) return <p className={styles.empty}>No photos attached to this claim.</p>;
  return <ClaimPhotoGallery compact={compact} photos={attachments.map(attachment => ({ id: attachment.id, url: `/api/demo/${sessionId}/claim-photos/${claimId}/${attachment.id}` }))}/>;
}
