import { ActorRole, ClaimStatus, Prisma } from "@prisma/client";
import { addCalendarMonths, dateOnly } from "@/lib/dates";
import { db } from "@/lib/db";

export async function seedDemo(tx: Prisma.TransactionClient, sessionId?: string) {
  const session = await tx.demoSession.create({ data: sessionId ? { id: sessionId } : {} });
  const brand = await tx.brand.create({ data: { demoSessionId: session.id, name: "Kestrel Audio", slug: "kestrel-audio", supportEmail: "support@kestrelaudio.example" } });
  const customer = await tx.customer.create({ data: { demoSessionId: session.id, name: "Aarav Demo", email: "aarav@example.test" } });
  const pro = await tx.productModel.create({ data: { brandId: brand.id, name: "Kestrel Pro Headphones", slug: "kestrel-pro", sku: "KST-PRO", warrantyMonths: 36, imageUrl: "/images/kestrel-pro-headphones.png" } });
  const charge = await tx.productModel.create({ data: { brandId: brand.id, name: "Kestrel Charge 20K", slug: "kestrel-charge-20k", sku: "KST-CHG", warrantyMonths: 36, imageUrl: "/images/kestrel-charge-powerbank.png" } });

  const fixtures = [
    { serial: "KST-10482", order: "ORD-201", model: pro, delivered: "2026-10-05", register: false, sampleClaim: false },
    { serial: "KST-10483", order: "ORD-202", model: pro, delivered: "2026-09-12", register: true, sampleClaim: false },
    { serial: "KST-20511", order: "ORD-203", model: charge, delivered: "2026-08-20", register: true, sampleClaim: false },
    { serial: "KST-30909", order: "ORD-204", model: pro, delivered: "2026-10-08", register: true, sampleClaim: true },
  ];

  for (const fixture of fixtures) {
    const deliveredOn = dateOnly(new Date(`${fixture.delivered}T00:00:00.000Z`));
    const order = await tx.purchaseOrder.create({ data: { brandId: brand.id, customerId: customer.id, orderNumber: fixture.order, deliveredOn } });
    const unit = await tx.productUnit.create({ data: { brandId: brand.id, productModelId: fixture.model.id, purchaseOrderId: order.id, serialNumber: fixture.serial, status: "DELIVERED" } });
    const sale = await tx.unitSale.create({ data: { unitId: unit.id, purchaseOrderId: order.id, confirmedDeliveredOn: deliveredOn } });
    await tx.unitLifecycleEvent.createMany({ data: [{ unitId: unit.id, eventType: "CREATED", source: "demo" }, { unitId: unit.id, eventType: "ORDER_ASSOCIATED", source: "demo", orderNumber: fixture.order }, { unitId: unit.id, eventType: "DELIVERED", source: "demo", orderNumber: fixture.order, detail: fixture.delivered }] });
    if (!fixture.register) continue;
    const registration = await tx.warrantyRegistration.create({ data: { unitId: unit.id, saleId: sale.id, customerId: customer.id, coverageStartsOn: deliveredOn, coverageEndsOn: addCalendarMonths(deliveredOn, fixture.model.warrantyMonths) } });
    await tx.productUnit.update({ where: { id: unit.id }, data: { activeRegistrationId: registration.id } });
    await tx.unitLifecycleEvent.create({ data: { unitId: unit.id, eventType: "REGISTERED", source: "demo", orderNumber: fixture.order } });
    if (fixture.sampleClaim) {
      const claim = await tx.warrantyClaim.create({ data: { registrationId: registration.id, reference: `VCH-${session.id.toUpperCase()}`, issueTitle: "Left earcup has stopped working", description: "The left side stopped producing sound during normal use.", status: ClaimStatus.UNDER_REVIEW } });
      await tx.claimEvent.create({ data: { claimId: claim.id, actor: ActorRole.CUSTOMER, toStatus: ClaimStatus.SUBMITTED, note: "Claim submitted" } });
      await tx.claimEvent.create({ data: { claimId: claim.id, actor: ActorRole.BRAND, fromStatus: ClaimStatus.SUBMITTED, toStatus: ClaimStatus.UNDER_REVIEW, note: "Our team is reviewing your claim." } });
    }
  }
  return session.id;
}

export async function createDemoSession(sessionId?: string) {
  return db.$transaction((tx) => seedDemo(tx, sessionId), { maxWait: 10000, timeout: 30000 });
}
