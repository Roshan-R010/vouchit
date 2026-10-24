"use client";

import { useFormStatus } from "react-dom";
import { CalendarDays } from "lucide-react";

export function SubmitClaimButton() {
  const { pending } = useFormStatus();
  return <button className="action" type="submit" disabled={pending} aria-disabled={pending}>
    {pending ? "Submitting claim…" : "Submit claim"} <CalendarDays size={14}/>
  </button>;
}
