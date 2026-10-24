"use server";

import { ActorRole, ClaimStatus, ResolutionMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireBrand } from "@/lib/brand";
import { db } from "@/lib/db";

export type BrandClaimActionState = { error?: string; success?: string };

const transitions: Record<string, { from: ClaimStatus; to: ClaimStatus; note: string }> = {
  review: { from: ClaimStatus.SUBMITTED, to: ClaimStatus.UNDER_REVIEW, note: "The brand started reviewing this claim." },
  approve: { from: ClaimStatus.UNDER_REVIEW, to: ClaimStatus.APPROVED, note: "The brand approved this claim." },
  reject: { from: ClaimStatus.UNDER_REVIEW, to: ClaimStatus.REJECTED, note: "The brand rejected this claim." },
  request_info: { from: ClaimStatus.UNDER_REVIEW, to: ClaimStatus.INFO_REQUESTED, note: "The brand requested more information." },
  resolve: { from: ClaimStatus.APPROVED, to: ClaimStatus.RESOLVED, note: "The brand resolved this claim." },
};

class ClaimActionError extends Error {}

export async function changeBrandClaimStatusAction(
  sessionId: string,
  claimId: string,
  _previousState: BrandClaimActionState,
  formData: FormData,
): Promise<BrandClaimActionState> {
  const brand = await requireBrand(sessionId);
  const decision = String(formData.get("decision") || "");
  const transition = Object.prototype.hasOwnProperty.call(transitions, decision) ? transitions[decision] : undefined;
  const note = String(formData.get("note") || "").trim();
  const resolution = String(formData.get("resolutionMethod") || "");

  if (!transition) return { error: "Choose a valid claim action." };
  if (note.length > 2000) return { error: "Keep your message under 2,000 characters." };
  if (["reject", "request_info", "resolve"].includes(decision) && !note) {
    return { error: decision === "request_info" ? "Enter the question you want the customer to answer." : decision === "resolve" ? "Describe the repair or replacement outcome." : "Enter a reason for rejecting this claim." };
  }
  if (decision === "resolve" && resolution !== ResolutionMethod.REPAIR && resolution !== ResolutionMethod.REPLACEMENT) {
    return { error: "Choose whether the product was repaired or replaced." };
  }

  try {
    await db.$transaction(async (tx) => {
      const scope = {
        id: claimId,
        registration: {
          customer: { demoSessionId: sessionId },
          unit: { brandId: brand.id, brand: { demoSessionId: sessionId } },
        },
      };
      const claim = await tx.warrantyClaim.findFirst({ where: scope, select: { id: true, status: true } });
      if (!claim) throw new ClaimActionError("This claim could not be found in your workspace.");
      if (claim.status !== transition.from) throw new ClaimActionError("This claim has changed. Refresh the page to see its latest status.");

      const changed = await tx.warrantyClaim.updateMany({
        where: { ...scope, status: transition.from },
        data: {
          status: transition.to,
          ...(decision === "resolve" ? { resolutionMethod: resolution as ResolutionMethod } : {}),
        },
      });
      if (changed.count !== 1) throw new ClaimActionError("Another update was made to this claim. Refresh the page and try again.");

      const eventNote = decision === "resolve"
        ? `${resolution === ResolutionMethod.REPAIR ? "Repaired" : "Replaced"}: ${note}`
        : note || transition.note;
      await tx.claimEvent.create({ data: { claimId, actor: ActorRole.BRAND, fromStatus: transition.from, toStatus: transition.to, note: eventNote } });
      if (note) await tx.claimMessage.create({ data: { claimId, author: ActorRole.BRAND, body: eventNote } });
    }, { maxWait: 10_000, timeout: 20_000 });
  } catch (error) {
    return { error: error instanceof ClaimActionError ? error.message : "We couldn’t save this update. Please try again." };
  }

  revalidatePath(`/demo/${sessionId}/brand`);
  revalidatePath(`/demo/${sessionId}/brand/claims`);
  revalidatePath(`/demo/${sessionId}/brand/claims/${claimId}`);
  revalidatePath(`/demo/${sessionId}/customer`);
  revalidatePath(`/demo/${sessionId}/customer/claims/${claimId}`);
  return { success: decision === "request_info" ? "Your question is now visible on the customer’s claim page." : "Claim updated. The customer can see the new status on their tracking page." };
}
