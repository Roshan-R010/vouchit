import { db } from "@/lib/db";
import { removeNewProductImage, removeSessionImages } from "@/lib/product-images";
import { seedDemo } from "@/lib/demo-fixtures";
export { createDemoSession } from "@/lib/demo-fixtures";

export async function resetDemoSession(sessionId: string) {
  const images = await db.productModel.findMany({ where: { brand: { demoSessionId: sessionId }, imageUrl: { not: null } }, select: { imageUrl: true } });
  const resetId = await db.$transaction(async (tx) => {
    await tx.demoSession.delete({ where: { id: sessionId } });
    return seedDemo(tx, sessionId);
  }, { maxWait: 10000, timeout: 30000 });
  await Promise.all(images.flatMap(({ imageUrl }) => imageUrl ? [removeNewProductImage(imageUrl)] : []));
  await removeSessionImages(sessionId);
  return resetId;
}

export async function sessionCustomer(sessionId: string) {
  return db.customer.findFirst({ where: { demoSessionId: sessionId }, select: { id: true, name: true, email: true } });
}

