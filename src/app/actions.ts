"use server";

import { ActorRole, ClaimStatus, NotificationType, Prisma } from "@prisma/client";
import { addCalendarMonths, dateOnly, isCoverageActive } from "@/lib/dates";
import { db } from "@/lib/db";
import { removeWorkspaceImage, saveWorkspaceImage, validateWorkspaceImage } from "@/lib/workspace-images";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (form: FormData, name: string) => String(form.get(name) || "").trim();

export async function registerWarrantyAction(formData: FormData) {
  const sessionId = text(formData, "sessionId");
  if (!uuid.test(sessionId)) redirect("/");
  const brandSlug = text(formData, "brandSlug");
  const productSlug = text(formData, "productSlug");
  const serialNumber = text(formData, "serialNumber").toUpperCase();
  const customerName = text(formData, "customerName");
  const email = text(formData, "email");
  const registrationPath = `/demo/${sessionId}/register/${encodeURIComponent(brandSlug)}/${encodeURIComponent(productSlug)}`;
  const fail = (error: string): never => redirect(`${registrationPath}?serialNumber=${encodeURIComponent(serialNumber)}&error=${error}`);
  if (!brandSlug || !productSlug || !serialNumber || serialNumber.length > 100) fail("missing");
  if (!customerName || customerName.length > 100 || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("contact");
  const customer = await db.customer.findFirst({ where: { demoSessionId: sessionId } });
  const unit = await db.productUnit.findFirst({
    where: { serialNumber, brand: { slug: brandSlug, demoSessionId: sessionId }, productModel: { slug: productSlug } },
    include: { productModel: true, purchaseOrder: true, registration: true },
  });
  if (!unit) return fail("not-found");
  if (unit.productModel.brandId !== unit.brandId || unit.purchaseOrder.brandId !== unit.brandId || (unit.purchaseOrder.customerId && unit.purchaseOrder.customerId !== customer?.id)) fail("not-found");
  if (unit.registration) {
    if (unit.registration.customerId !== customer?.id) fail("not-found");
    redirect(`/demo/${sessionId}/customer/products/${unit.id}?notice=already-registered`);
  }
  const deliveredOn = unit.purchaseOrder.deliveredOn;
  if (!deliveredOn || dateOnly(deliveredOn).getTime() > dateOnly(new Date()).getTime()) return fail("not-delivered");
  const start = dateOnly(deliveredOn);
  const end = addCalendarMonths(start, unit.productModel.warrantyMonths);
  try {
    await db.$transaction(async (tx) => {
      await tx.demoSession.update({ where: { id: sessionId }, data: { id: sessionId } });
      let owner = await tx.customer.findFirst({ where: { demoSessionId: sessionId } });
      if (!owner) owner = await tx.customer.create({ data: { demoSessionId: sessionId, name: customerName, email } });
      else await tx.customer.update({ where: { id: owner.id }, data: { name: customerName, email } });
      const registration = await tx.warrantyRegistration.create({ data: { unitId: unit.id, customerId: owner.id, coverageStartsOn: start, coverageEndsOn: end } });
      await tx.demoNotification.create({ data: {
        demoSessionId: sessionId, type: NotificationType.WARRANTY_REGISTERED, recipientLabel: "Customer",
        subject: "Your warranty is registered", previewBody: `${unit.productModel.name} (${serialNumber}) is covered from ${start.toISOString().slice(0, 10)} through ${end.toISOString().slice(0, 10)}. Preview — not sent.`, relatedId: registration.id,
      } });
    }, { timeout: 15000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.warrantyRegistration.findFirst({ where: { unitId: unit.id, customer: { demoSessionId: sessionId } } });
      if (existing) redirect(`/demo/${sessionId}/customer/products/${unit.id}?notice=already-registered`);
    }
    throw error;
  }
  revalidatePath(`/demo/${sessionId}`, "layout");
  redirect(`/demo/${sessionId}/customer/products/${unit.id}?notice=registered`);
}

export type ClaimActionState = { error?: string };

export async function submitClaimAction(_state: ClaimActionState, formData: FormData): Promise<ClaimActionState> {
  const sessionId = text(formData, "sessionId");
  const unitId = text(formData, "unitId");
  if (!uuid.test(sessionId) || !uuid.test(unitId)) redirect("/");
  const issueTitle = text(formData, "issueTitle");
  const description = text(formData, "description");
  const submissionId = text(formData, "submissionId");
  if (!uuid.test(submissionId) || !issueTitle || issueTitle.length > 120 || !description || description.length > 3000) return { error: "Enter an issue title and description." };
  const registration = await db.warrantyRegistration.findFirst({
    where: { unitId, customer: { demoSessionId: sessionId }, unit: { brand: { demoSessionId: sessionId } } },
    include: { claim: { select: { id: true } }, unit: { include: { productModel: true, brand: true, purchaseOrder: true } } },
  });
  if (!registration || registration.unit.productModel.brandId !== registration.unit.brandId || registration.unit.purchaseOrder.brandId !== registration.unit.brandId) return { error: "Register this product before raising a claim." };
  if (registration.claim) redirect(`/demo/${sessionId}/customer/claims/${registration.claim.id}`);
  if (!isCoverageActive(registration.coverageEndsOn) || dateOnly(registration.coverageStartsOn).getTime() > dateOnly(new Date()).getTime()) return { error: "This product is outside its warranty coverage." };
  const photos = formData.getAll("photos").filter((file): file is File => file instanceof File && file.size > 0);
  if (photos.length > 3) return { error: "Attach up to three photos." };
  const reference = `VCH-${submissionId.replaceAll("-", "").toUpperCase()}`;
  const uploaded: string[] = [];
  let claim: { id: string };
  try {
    photos.forEach(validateWorkspaceImage);
    for (const photo of photos) uploaded.push(await saveWorkspaceImage(sessionId, "claims", submissionId, photo));
    claim = await db.$transaction(async (tx) => {
      const created = await tx.warrantyClaim.create({ data: { id: submissionId, registrationId: registration.id, reference, issueTitle, description, status: ClaimStatus.SUBMITTED, attachments: { create: uploaded.map((fileKey) => ({ fileKey })) } } });
      await tx.claimEvent.create({ data: { claimId: created.id, actor: ActorRole.CUSTOMER, toStatus: ClaimStatus.SUBMITTED, note: "Claim submitted" } });
      await tx.demoNotification.createMany({ data: [
        { demoSessionId: sessionId, type: NotificationType.CLAIM_SUBMITTED_CUSTOMER, recipientLabel: "Customer", subject: "We received your warranty claim", previewBody: `${reference} was submitted. Preview — not sent.`, relatedId: created.id },
        { demoSessionId: sessionId, type: NotificationType.CLAIM_SUBMITTED_BRAND, recipientLabel: registration.unit.brand.name, subject: "New warranty claim", previewBody: `${reference} was submitted. Preview — not sent.`, relatedId: created.id },
      ] });
      return created;
    }, { timeout: 15000 });
  } catch (error) {
    await Promise.all(uploaded.map(removeWorkspaceImage));
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.warrantyClaim.findFirst({ where: { registrationId: registration.id }, select: { id: true } });
      if (existing) redirect(`/demo/${sessionId}/customer/claims/${existing.id}`);
    }
    return { error: error instanceof Error && !error.message.includes("prisma") ? error.message : "The claim could not be saved. Please try again." };
  }
  revalidatePath(`/demo/${sessionId}`, "layout");
  redirect(`/demo/${sessionId}/customer/claims/${claim.id}`);
}

export async function replyToInfoRequestAction(formData: FormData) {
  const sessionId = text(formData, "sessionId");
  const claimId = text(formData, "claimId");
  if (!uuid.test(sessionId) || !uuid.test(claimId)) redirect("/");
  const body = text(formData, "reply");
  const path = `/demo/${sessionId}/customer/claims/${claimId}`;
  if (!body || body.length > 2000) redirect(`${path}?error=reply`);
  await db.$transaction(async (tx) => {
    const changed = await tx.warrantyClaim.updateMany({
      where: { id: claimId, status: ClaimStatus.INFO_REQUESTED, registration: { customer: { demoSessionId: sessionId }, unit: { brand: { demoSessionId: sessionId } } } },
      data: { status: ClaimStatus.UNDER_REVIEW },
    });
    if (changed.count !== 1) return;
    await tx.claimMessage.create({ data: { claimId, author: ActorRole.CUSTOMER, body } });
    await tx.claimEvent.create({ data: { claimId, actor: ActorRole.CUSTOMER, fromStatus: ClaimStatus.INFO_REQUESTED, toStatus: ClaimStatus.UNDER_REVIEW, note: "Customer replied to the information request." } });
  });
  revalidatePath(`/demo/${sessionId}`, "layout");
  redirect(path);
}
