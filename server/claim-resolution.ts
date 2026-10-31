import { randomUUID } from "node:crypto";
import { ClaimStatus, NotificationType, Prisma, ResolutionStatus, ResolutionType } from "@prisma/client";
import { db } from "../src/lib/db";

export const resolutionSteps: Record<ResolutionType, string[]> = {
  REPAIR: ["STARTED", "COLLECTION_ARRANGED", "RECEIVED", "REPAIR_IN_PROGRESS", "REPAIR_COMPLETED", "RETURN_DISPATCHED", "COMPLETED"],
  REPLACEMENT: ["STARTED", "REPLACEMENT_PREPARED", "REPLACEMENT_DISPATCHED", "REPLACEMENT_DELIVERED", "COMPLETED"],
  REFUND: ["STARTED", "REFUND_INITIATED", "REFUND_COMPLETED", "COMPLETED"],
};
export type ResolutionAction = "START" | "PROGRESS" | "COMPLETE" | "CANCEL" | "CHANGE_TYPE" | "RESTART";
export type ResolutionInput = {
  action: ResolutionAction;
  requestId: string;
  type?: ResolutionType;
  step?: string;
  occurredOn?: string;
  serviceReference?: string;
  trackingNumber?: string;
  courier?: string;
  refundAmount?: string;
  refundCurrency?: string;
  replacementUnitId?: string;
  internalNote?: string;
  customerMessage?: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validType = (value: unknown): value is ResolutionType => Object.values(ResolutionType).includes(value as ResolutionType);
const textField = (value: unknown, max: number, label: string) => {
  const clean = String(value ?? "").trim();
  if (clean.length > max || /[\u0000-\u001f\u007f]/.test(clean)) throw new Error(`${label} must be ${max} characters or fewer.`);
  return clean || null;
};
const eventDate = (value: unknown) => {
  if (!value) return null;
  const text = String(value);
  const date = new Date(`${text}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text || date.getTime() > Date.now()) throw new Error("Choose an actual event date that is not in the future.");
  return date;
};
const publicLabel = (type: ResolutionType, step: string) => {
  if (step === "COMPLETED") return type === "REFUND" ? "Refund marked as completed by the brand." : `${type === "REPAIR" ? "Repair" : "Replacement"} resolution completed.`;
  return `${type === "REPAIR" ? "Repair" : type === "REPLACEMENT" ? "Replacement" : "Refund"}: ${step.toLowerCase().replaceAll("_", " ")}.`;
};

export async function updateClaimResolution(brandId: string, sessionId: string, claimId: string, accountId: string | null, input: ResolutionInput, client: typeof db = db) {
  if (!uuid.test(claimId) || !uuid.test(input?.requestId)) throw new Error("Invalid claim or request ID.");
  if (!["START", "PROGRESS", "COMPLETE", "CANCEL", "CHANGE_TYPE", "RESTART"].includes(input.action)) throw new Error("Choose a valid resolution action.");
  const internalNote = textField(input.internalNote, 2000, "Internal note");
  const customerMessage = textField(input.customerMessage, 500, "Customer update");
  const serviceReference = textField(input.serviceReference, 120, "Service reference");
  const trackingNumber = textField(input.trackingNumber, 120, "Tracking number");
  const courier = textField(input.courier, 100, "Courier");
  const occurredOn = eventDate(input.occurredOn);
  const refundAmount = input.refundAmount ? String(input.refundAmount).trim() : "";
  if (refundAmount && !/^\d{1,10}(\.\d{1,2})?$/.test(refundAmount)) throw new Error("Enter a valid refund amount with up to two decimal places.");
  const refundCurrency = input.refundCurrency ? String(input.refundCurrency).trim().toUpperCase() : "";
  if (refundCurrency && !/^[A-Z]{3}$/.test(refundCurrency)) throw new Error("Use a three-letter currency code.");
  if (refundAmount && !refundCurrency) throw new Error("Choose a currency for the refund amount.");
  if (input.replacementUnitId && !uuid.test(input.replacementUnitId)) throw new Error("Choose a valid replacement unit.");

  const operation = async () => client.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "WarrantyClaim" WHERE id = ${claimId}::uuid FOR UPDATE`;
    const claim = await tx.warrantyClaim.findFirst({ where: { id: claimId, registration: { unit: { brandId }, customer: { demoSessionId: sessionId } } }, include: { registration: { include: { unit: { select: { id: true, brandId: true, serialNumber: true } } } }, resolution: { include: { events: { orderBy: { createdAt: "asc" } } } } } });
    if (!claim) throw new Error("Claim not found in this brand.");
    const replay = await tx.claimResolutionEvent.findUnique({ where: { requestId: input.requestId }, include: { resolution: true } });
    if (replay) {
      if (replay.resolution.claimId !== claimId) throw new Error("This request ID belongs to another claim.");
      return { resolution: claim.resolution!, event: replay, replayed: true, unitId: claim.registration.unit.id };
    }
    const prior = claim.resolution;
    let type: ResolutionType;
    let step: string;
    let status: ResolutionStatus;
    if (input.action === "START") {
      if (claim.status !== ClaimStatus.APPROVED || prior) throw new Error("Only an approved claim without a resolution can start one.");
      if (!validType(input.type)) throw new Error("Choose repair, replacement, or refund.");
      type = input.type; step = "STARTED"; status = ResolutionStatus.IN_PROGRESS;
    } else {
      if (!prior) throw new Error("Start a resolution before recording progress.");
      type = prior.type; step = prior.step; status = prior.status;
      if (input.action === "PROGRESS") {
        if (claim.status !== ClaimStatus.APPROVED || prior.status !== ResolutionStatus.IN_PROGRESS) throw new Error("Only an active approved resolution can progress.");
        const steps = resolutionSteps[type];
        if (!input.step || input.step === "COMPLETED" || !steps.includes(input.step) || steps.indexOf(input.step) <= steps.indexOf(prior.step)) throw new Error("Choose a later valid progress step.");
        step = input.step;
      } else if (input.action === "COMPLETE") {
        if (claim.status !== ClaimStatus.APPROVED || prior.status !== ResolutionStatus.IN_PROGRESS) throw new Error("Only an active approved resolution can be completed.");
        const prerequisite = type === ResolutionType.REPAIR ? "REPAIR_COMPLETED" : type === ResolutionType.REPLACEMENT ? "REPLACEMENT_DELIVERED" : "REFUND_COMPLETED";
        if (resolutionSteps[type].indexOf(prior.step) < resolutionSteps[type].indexOf(prerequisite)) throw new Error(`Record ${prerequisite.toLowerCase().replaceAll("_", " ")} before completing the resolution.`);
        step = "COMPLETED"; status = ResolutionStatus.COMPLETED;
      } else if (input.action === "CANCEL") {
        if (claim.status !== ClaimStatus.APPROVED || prior.status !== ResolutionStatus.IN_PROGRESS) throw new Error("Only an active resolution can be cancelled.");
        if (!internalNote) throw new Error("Record why the resolution was cancelled.");
        status = ResolutionStatus.CANCELLED;
      } else if (input.action === "CHANGE_TYPE") {
        if (claim.status !== ClaimStatus.APPROVED || prior.status !== ResolutionStatus.IN_PROGRESS || prior.step !== "STARTED") throw new Error("Change the type before operational progress begins; cancel and restart otherwise.");
        if (!validType(input.type) || input.type === prior.type) throw new Error("Choose a different resolution type.");
        if (!internalNote) throw new Error("Record why the resolution type changed.");
        type = input.type;
      } else {
        if (claim.status !== ClaimStatus.APPROVED || prior.status !== ResolutionStatus.CANCELLED) throw new Error("Only a cancelled resolution can be restarted.");
        if (!validType(input.type)) throw new Error("Choose a resolution type to restart.");
        if (!internalNote) throw new Error("Record why the resolution was restarted.");
        type = input.type; step = "STARTED"; status = ResolutionStatus.IN_PROGRESS;
      }
    }
    const replacementUnitId = type === ResolutionType.REPLACEMENT ? input.replacementUnitId || (input.action === "RESTART" ? null : prior?.replacementUnitId) || null : null;
    if (input.replacementUnitId && type !== ResolutionType.REPLACEMENT) throw new Error("A replacement unit can only be linked to a replacement resolution.");
    if (replacementUnitId && replacementUnitId !== prior?.replacementUnitId) {
      const replacement = await tx.productUnit.findFirst({ where: { id: replacementUnitId, brandId }, include: { registrations: { select: { id: true }, take: 1 } } });
      if (!replacement || replacement.id === claim.registration.unit.id || replacement.purchaseOrderId || replacement.activeRegistrationId || replacement.registrations.length) throw new Error("Choose an unassigned, unregistered replacement unit from this brand.");
    }
    if (prior?.replacementUnitId && prior.replacementUnitId !== replacementUnitId) {
      await tx.unitLifecycleEvent.createMany({ data: [{ unitId: claim.registration.unit.id, eventType: "REPLACEMENT_UNLINKED", accountId, source: `claim:${claimId}`, detail: prior.replacementUnitId }, { unitId: prior.replacementUnitId, eventType: "REPLACEMENT_UNLINKED", accountId, source: `claim:${claimId}`, detail: claim.registration.unit.serialNumber }] });
    }
    if (input.action === "COMPLETE" && type === ResolutionType.REPLACEMENT && !replacementUnitId) throw new Error("Link the replacement unit before completing the resolution.");
    if (input.action === "COMPLETE" && type === ResolutionType.REPLACEMENT && replacementUnitId !== prior?.replacementUnitId) throw new Error("Link the replacement unit in a saved progress update before completing the resolution.");
    const method = type === ResolutionType.REFUND ? null : type;
    if (input.action === "START" || input.action === "CHANGE_TYPE" || input.action === "RESTART") await tx.warrantyClaim.update({ where: { id: claimId }, data: { resolutionMethod: method } });
    const data = { type, status, step, serviceReference: serviceReference ?? prior?.serviceReference ?? null, trackingNumber: trackingNumber ?? prior?.trackingNumber ?? null, courier: courier ?? prior?.courier ?? null, refundAmount: type === ResolutionType.REFUND && refundAmount ? new Prisma.Decimal(refundAmount) : type === ResolutionType.REFUND ? prior?.refundAmount ?? null : null, refundCurrency: type === ResolutionType.REFUND ? refundCurrency || prior?.refundCurrency || null : null, replacementUnitId: type === ResolutionType.REPLACEMENT ? replacementUnitId : null, updatedById: accountId, completedAt: status === ResolutionStatus.COMPLETED ? new Date() : null };
    const resolution = prior ? await tx.claimResolution.update({ where: { id: prior.id }, data }) : await tx.claimResolution.create({ data: { claimId, ...data, createdById: accountId } });
    const event = await tx.claimResolutionEvent.create({ data: { resolutionId: resolution.id, requestId: input.requestId, action: input.action, fromType: prior?.type ?? null, toType: type, fromStatus: prior?.status ?? null, toStatus: status, fromStep: prior?.step ?? null, toStep: step, occurredOn, referenceNumber: serviceReference, internalNote, customerMessage, actorAccountId: accountId } });
    if (replacementUnitId && replacementUnitId !== prior?.replacementUnitId) {
      await tx.unitLifecycleEvent.createMany({ data: [{ unitId: claim.registration.unit.id, eventType: "REPLACEMENT_LINKED", accountId, source: `claim:${claimId}`, detail: replacementUnitId }, { unitId: replacementUnitId, eventType: "REPLACEMENT_LINKED", accountId, source: `claim:${claimId}`, detail: claim.registration.unit.serialNumber }] });
    }
    if (input.action === "COMPLETE") {
      await tx.warrantyClaim.update({ where: { id: claimId }, data: { status: ClaimStatus.RESOLVED } });
      await tx.claimEvent.create({ data: { claimId, actor: "BRAND", fromStatus: ClaimStatus.APPROVED, toStatus: ClaimStatus.RESOLVED, note: publicLabel(type, step) } });
      await tx.unitLifecycleEvent.create({ data: { unitId: claim.registration.unit.id, eventType: "CLAIM_RESOLVED", accountId, source: `claim:${claimId}`, detail: type } });
    }
    return { resolution, event, replayed: false, unitId: claim.registration.unit.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  let result;
  try { result = await operation(); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const replay = await client.claimResolutionEvent.findUnique({ where: { requestId: input.requestId }, include: { resolution: true } });
      if (replay?.resolution.claimId === claimId) return { resolution: replay.resolution, event: replay, replayed: true };
    }
    throw error;
  }
  if (!result.replayed && (["START", "COMPLETE"].includes(input.action) || ["REPAIR_IN_PROGRESS", "RETURN_DISPATCHED", "REPLACEMENT_DISPATCHED", "REFUND_COMPLETED"].includes(result.event.toStep))) {
    try {
      await client.demoNotification.create({ data: { demoSessionId: sessionId, type: NotificationType.CLAIM_RESOLUTION_UPDATE, recipientLabel: "Customer", subject: input.action === "COMPLETE" ? "Claim resolution completed" : "Claim resolution update", previewBody: customerMessage || publicLabel(result.resolution.type, result.event.toStep), relatedId: claimId, eventKey: `resolution/${result.event.id}` } });
    } catch (error) { console.error("Resolution notification could not be saved:", error); }
  }
  return result;
}
