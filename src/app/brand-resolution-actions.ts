"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireBrand } from "@/lib/brand";
import { updateClaimResolution, type ResolutionAction, type ResolutionInput } from "../../server/claim-resolution";

export async function saveBrandResolutionAction(sessionId: string, claimId: string, _state: { error?: string; success?: string }, form: FormData) {
  try {
    const brand = await requireBrand(sessionId);
    const input: ResolutionInput = {
      action: String(form.get("action")) as ResolutionAction,
      requestId: randomUUID(),
      type: String(form.get("type") || "") as ResolutionInput["type"],
      step: String(form.get("step") || ""),
      serviceReference: String(form.get("serviceReference") || ""),
      trackingNumber: String(form.get("trackingNumber") || ""),
      courier: String(form.get("courier") || ""),
      refundAmount: String(form.get("refundAmount") || ""),
      refundCurrency: String(form.get("refundCurrency") || ""),
      replacementUnitId: String(form.get("replacementUnitId") || ""),
      internalNote: String(form.get("internalNote") || ""),
      customerMessage: String(form.get("customerMessage") || ""),
    };
    await updateClaimResolution(brand.id, sessionId, claimId, null, input);
    revalidatePath(`/demo/${sessionId}/brand/claims/${claimId}`);
    revalidatePath(`/demo/${sessionId}/customer/claims/${claimId}`);
    revalidatePath(`/demo/${sessionId}/brand/claims`);
    revalidatePath(`/demo/${sessionId}/customer`);
    return { success: "Resolution updated." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Could not update the resolution." }; }
}
