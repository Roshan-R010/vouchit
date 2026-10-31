import { ActorRole, NotificationType, Prisma, UnitStatus } from "@prisma/client";
import { db } from "../src/lib/db";

export type LifecycleAction =
  | { type: "RETURN" }
  | { type: "FOR_SALE_AGAIN" }
  | { type: "ASSOCIATE_ORDER"; orderNumber: string }
  | { type: "DELIVER"; deliveredOn: string };

const day = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Enter a delivery date in YYYY-MM-DD format.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || date.getTime() > Date.now()) throw new Error("Enter a valid confirmed delivery date that is not in the future.");
  return date;
};

export async function changeUnitLifecycle(brandId: string, unitId: string, accountId: string | null, source: string, action: LifecycleAction, transaction?: Prisma.TransactionClient) {
  const run = async (tx: Prisma.TransactionClient) => {
    await tx.$queryRaw`SELECT id FROM "ProductUnit" WHERE id = ${unitId}::uuid AND "brandId" = ${brandId}::uuid FOR UPDATE`;
    const unit = await tx.productUnit.findFirst({ where: { id: unitId, brandId }, include: { registration: { include: { customer: true, claim: true } }, productModel: true, purchaseOrder: true, sales: { where: { isCurrent: true }, take: 1 } } });
    if (!unit) throw new Error("Unit not found in this brand.");
    const sale = unit.sales[0];
    const event = (eventType: string, orderNumber?: string, detail?: string) => tx.unitLifecycleEvent.create({ data: { unitId, eventType, accountId, source, orderNumber, detail } });
    if (action.type === "RETURN") {
      if (unit.status !== UnitStatus.DELIVERED && unit.status !== UnitStatus.PENDING) throw new Error("Only a current sale can be marked returned.");
      if (!sale) throw new Error("Associate an order before recording a return.");
      if (unit.registration) {
        if (unit.registration.claim && !["RESOLVED", "REJECTED"].includes(unit.registration.claim.status)) {
          await tx.warrantyClaim.update({ where: { id: unit.registration.claim.id }, data: { requiresReturnReview: true } });
          await tx.claimEvent.create({ data: { claimId: unit.registration.claim.id, actor: ActorRole.BRAND, fromStatus: unit.registration.claim.status, toStatus: unit.registration.claim.status, note: "Unit returned; claim requires brand review." } });
        }
        await tx.warrantyRegistration.update({ where: { id: unit.registration.id }, data: { active: false, deactivatedAt: new Date(), deactivationReason: "RETURNED" } });
        await tx.productUnit.update({ where: { id: unitId }, data: { activeRegistrationId: null, status: UnitStatus.RETURNED } });
        await event("WARRANTY_DEACTIVATED", unit.purchaseOrder?.orderNumber, unit.registration.claim ? "Existing claim requires review." : undefined);
        await tx.demoNotification.create({ data: { demoSessionId: unit.registration.customer.demoSessionId, type: NotificationType.WARRANTY_ENDED, recipientLabel: "Customer", subject: "Warranty registration ended", previewBody: `Your warranty for ${unit.productModel.name} has been deactivated because the product was marked as returned.`, relatedId: unit.registration.id } });
      } else await tx.productUnit.update({ where: { id: unitId }, data: { status: UnitStatus.RETURNED } });
      await event("RETURNED", unit.purchaseOrder?.orderNumber);
    } else if (action.type === "FOR_SALE_AGAIN") {
      if (unit.status !== UnitStatus.RETURNED || unit.registration) throw new Error("Complete the return before making this unit available for resale.");
      await tx.productUnit.update({ where: { id: unitId }, data: { status: UnitStatus.FOR_SALE_AGAIN } });
      await event("FOR_SALE_AGAIN");
    } else if (action.type === "ASSOCIATE_ORDER") {
      const orderNumber = action.orderNumber?.trim();
      if (!orderNumber || orderNumber.length > 120) throw new Error("Enter a valid new Order ID.");
      if (unit.status !== UnitStatus.FOR_SALE_AGAIN || unit.registration) throw new Error("Mark the returned unit For Sale Again before associating a new order.");
      if (unit.purchaseOrder?.orderNumber === orderNumber) throw new Error("Use a new Order ID for the resale.");
      if (await tx.unitSale.count({ where: { unitId, purchaseOrder: { orderNumber } } })) throw new Error("This unit used that Order ID in an earlier sale. Use the new sale's Order ID.");
      const order = await tx.purchaseOrder.upsert({ where: { brandId_orderNumber: { brandId, orderNumber } }, create: { brandId, orderNumber }, update: {} });
      if (sale) await tx.unitSale.update({ where: { id: sale.id }, data: { isCurrent: false, endedAt: new Date() } });
      await tx.unitSale.create({ data: { unitId, purchaseOrderId: order.id } });
      await tx.productUnit.update({ where: { id: unitId }, data: { purchaseOrderId: order.id, status: UnitStatus.PENDING } });
      await event("ORDER_ASSOCIATED", orderNumber);
    } else {
      if (unit.status !== UnitStatus.PENDING || !sale) throw new Error("Only a pending current sale can be confirmed delivered.");
      const deliveredOn = day(action.deliveredOn);
      await tx.unitSale.update({ where: { id: sale.id }, data: { confirmedDeliveredOn: deliveredOn } });
      await tx.productUnit.update({ where: { id: unitId }, data: { status: UnitStatus.DELIVERED } });
      await event("DELIVERED", unit.purchaseOrder?.orderNumber, action.deliveredOn);
    }
    return tx.productUnit.findUniqueOrThrow({ where: { id: unitId }, include: { purchaseOrder: true, registration: { select: { id: true } }, sales: { where: { isCurrent: true } } } });
  };
  return transaction ? run(transaction) : db.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
