import { db } from "@/lib/db";
import { removeNewProductImage, removeSessionImages } from "@/lib/product-images";
import { removeWorkspaceImage } from "@/lib/workspace-images";
export { createDemoSession } from "@/lib/demo-session";

export async function resetDemoSession(sessionId: string) {
  const images = await db.productModel.findMany({ where: { brand: { demoSessionId: sessionId }, imageUrl: { not: null } }, select: { imageUrl: true } });
  const logos = await db.brand.findMany({ where: { demoSessionId: sessionId }, select: { logoUrl: true } });
  const attachments = await db.claimAttachment.findMany({ where: { claim: { registration: { customer: { demoSessionId: sessionId } } } }, select: { fileKey: true } });
  const resetId = await db.$transaction(async (tx) => {
    await tx.demoSession.delete({ where: { id: sessionId } });
    return (await tx.demoSession.create({ data: { id: sessionId } })).id;
  }, { maxWait: 10000, timeout: 30000 });
  await Promise.all(images.flatMap(({ imageUrl }) => imageUrl ? [removeNewProductImage(imageUrl)] : []));
  await removeSessionImages(sessionId);
  await Promise.all([...logos.flatMap((brand) => brand.logoUrl ? [brand.logoUrl] : []), ...attachments.map((file) => file.fileKey)].map(removeWorkspaceImage));
  return resetId;
}

export async function sessionCustomer(sessionId: string) {
  return db.customer.findFirst({ where: { demoSessionId: sessionId }, select: { id: true, name: true, email: true } });
}

