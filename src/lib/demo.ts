import { db } from "@/lib/db";
import { removeNewProductImage, removeSessionImages } from "@/lib/product-images";

/** Creates an intentionally empty workspace. Brand details are collected in setup. */
export async function createDemoSession(sessionId?: string) {
  const session = await db.demoSession.create({ data: sessionId ? { id: sessionId } : {} });
  return session.id;
}

export async function resetDemoSession(sessionId: string) {
  const [products, brands] = await Promise.all([
    db.productModel.findMany({ where: { brand: { demoSessionId: sessionId }, imageUrl: { not: null } }, select: { imageUrl: true } }),
    db.brand.findMany({ where: { demoSessionId: sessionId, logoUrl: { not: null } }, select: { logoUrl: true } }),
  ]);
  const resetId = await db.$transaction(async (tx) => {
    await tx.demoSession.delete({ where: { id: sessionId } });
    const session = await tx.demoSession.create({ data: { id: sessionId } });
    return session.id;
  }, { maxWait: 10000, timeout: 30000 });
  await Promise.all([...products.map(({ imageUrl }) => imageUrl), ...brands.map(({ logoUrl }) => logoUrl)].flatMap((url) => url ? [removeNewProductImage(url)] : []));
  await removeSessionImages(sessionId);
  return resetId;
}

export async function sessionCustomer(sessionId: string) {
  return db.customer.findFirst({ where: { demoSessionId: sessionId }, select: { id: true, name: true, email: true } });
}

