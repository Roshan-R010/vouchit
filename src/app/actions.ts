"use server";

import { ActorRole, ClaimStatus, NotificationType, Prisma } from "@prisma/client";
import { addCalendarMonths, dateOnly, isCoverageActive } from "@/lib/dates";
import { db } from "@/lib/db";
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
  const unit = await db.productUnit.findFirst({
    where: { serialNumber, brand: { slug: brandSlug, demoSessionId: sessionId }, productModel: { slug: productSlug } },
    include: { productModel: true, purchaseOrder: true, registration: true },
  });
  if (!unit) redirect(`${registrationPath}?serialNumber=${encodeURIComponent(serialNumber)}&error=not-found`);
  const customer = await db.customer.findFirst({ where: { demoSessionId: sessionId, email } });
  if (unit.productModel.brandId !== unit.brandId || unit.purchaseOrder.brandId !== unit.brandId || (unit.purchaseOrder.customerId && customer && unit.purchaseOrder.customerId !== customer.id)) fail("not-found");
  if (unit.registration) {
    if (!customer || unit.registration.customerId !== customer.id) fail("not-found");
    redirect(`/demo/${sessionId}/customer/products/${unit.id}?notice=already-registered`);
  }
  const deliveredOn = unit.purchaseOrder.deliveredOn;
  if (!deliveredOn || dateOnly(deliveredOn).getTime() > dateOnly(new Date()).getTime()) redirect(`${registrationPath}?serialNumber=${encodeURIComponent(serialNumber)}&error=not-delivered`);
  const start = dateOnly(deliveredOn);
  const end = addCalendarMonths(start, unit.productModel.warrantyMonths);
  try {
    await db.$transaction(async (tx) => {
      const registeredCustomer = customer ?? await tx.customer.create({ data: { demoSessionId: sessionId, name: customerName, email } });
      if (customer) await tx.customer.update({ where: { id: customer.id }, data: { name: customerName, email } });
      const registration = await tx.warrantyRegistration.create({ data: { unitId: unit.id, customerId: registeredCustomer.id, coverageStartsOn: start, coverageEndsOn: end } });
      await tx.demoNotification.create({ data: {
        demoSessionId: sessionId, type: NotificationType.WARRANTY_REGISTERED, recipientLabel: "Customer",
        subject: "Your warranty is registered", previewBody: `${unit.productModel.name} (${serialNumber}) is covered from ${start.toISOString().slice(0, 10)} through ${end.toISOString().slice(0, 10)}. Preview — not sent.`, relatedId: registration.id,
      } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.warrantyRegistration.findFirst({ where: { unitId: unit.id } });
      if (existing) redirect(`/demo/${sessionId}/customer/products/${unit.id}?notice=already-registered`);
    }
    throw error;
  }
  revalidatePath(`/demo/${sessionId}`, "layout");
  redirect(`/demo/${sessionId}/customer/products/${unit.id}?notice=registered`);
}

export async function submitClaimAction(formData: FormData) {
  const sessionId = text(formData, "sessionId");
  const unitId = text(formData, "unitId");
  if (!uuid.test(sessionId) || !uuid.test(unitId)) redirect("/");
  const issueTitle = text(formData, "issueTitle");
  const description = text(formData, "description");
  const submissionId = text(formData, "submissionId");
  const claimPath = `/demo/${sessionId}/customer/claims/new?unitId=${unitId}`;
  if (!uuid.test(submissionId) || !issueTitle || issueTitle.length > 120 || !description || description.length > 3000) redirect(`${claimPath}&error=missing`);
  const registration = await db.warrantyRegistration.findFirst({
    where: { unitId, customer: { demoSessionId: sessionId }, unit: { brand: { demoSessionId: sessionId } } },
    include: { claim: { select: { id: true } }, unit: { include: { productModel: true, brand: true, purchaseOrder: true } }, customer: true },
  });
  if (!registration || registration.unit.productModel.brandId !== registration.unit.brandId || registration.unit.purchaseOrder.brandId !== registration.unit.brandId) redirect(`/demo/${sessionId}/customer?error=registration-required`);
  if (registration.claim) redirect(`/demo/${sessionId}/customer/claims/${registration.claim.id}`);
  if (!isCoverageActive(registration.coverageEndsOn) || dateOnly(registration.coverageStartsOn).getTime() > dateOnly(new Date()).getTime()) redirect(`${claimPath}&error=expired`);
  const reference = `VCH-${submissionId.replaceAll("-", "").toUpperCase()}`;
  let claim: { id: string };
  try {
    claim = await db.$transaction(async (tx) => {
    const created = await tx.warrantyClaim.create({ data: { id: submissionId, registrationId: registration.id, reference, issueTitle, description, status: ClaimStatus.SUBMITTED } });
    await tx.claimEvent.create({ data: { claimId: created.id, actor: ActorRole.CUSTOMER, toStatus: ClaimStatus.SUBMITTED, note: "Claim submitted" } });
    await tx.demoNotification.createMany({ data: [
      { demoSessionId: sessionId, type: NotificationType.CLAIM_SUBMITTED_CUSTOMER, recipientLabel: "Customer", subject: "We received your warranty claim", previewBody: `${reference} was submitted. Track it at /demo/${sessionId}/customer/claims/${created.id}. Preview — not sent.`, relatedId: created.id },
      { demoSessionId: sessionId, type: NotificationType.CLAIM_SUBMITTED_BRAND, recipientLabel: registration.unit.brand.name, subject: "New warranty claim", previewBody: `${reference} was submitted. Open /demo/${sessionId}/brand/claims/${created.id} to review. Preview — not sent.`, relatedId: created.id },
    ] });
    return created;
  });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.warrantyClaim.findFirst({ where: { registrationId: registration.id }, select: { id: true } });
      if (existing) redirect(`/demo/${sessionId}/customer/claims/${existing.id}`);
    }
    throw error;
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
