"use client";

import { useFormStatus } from "react-dom";

export function CustomerSubmit({ label, pendingLabel = "Saving…" }: { label: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="action" disabled={pending} aria-disabled={pending} style={{ opacity: pending ? 0.65 : 1 }}>{pending ? pendingLabel : label}</button>;
}
