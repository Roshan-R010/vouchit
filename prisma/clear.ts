import { db } from "../src/lib/db";
import { removeNewProductImage, removeSessionImages } from "../src/lib/product-images";

async function clear() {
  const [products, brands, sessions] = await Promise.all([
    db.productModel.findMany({ where: { imageUrl: { not: null } }, select: { imageUrl: true } }),
    db.brand.findMany({ where: { logoUrl: { not: null } }, select: { logoUrl: true } }),
    db.demoSession.findMany({ select: { id: true } }),
  ]);
  const result = await db.demoSession.deleteMany();
  await Promise.all([
    ...products.map(({ imageUrl }) => imageUrl && removeNewProductImage(imageUrl)),
    ...brands.map(({ logoUrl }) => logoUrl && removeNewProductImage(logoUrl)),
    ...sessions.map(({ id }) => removeSessionImages(id)),
  ]);
  console.log(`Cleared ${result.count} demo workspace(s) and uploaded images.`);
}

clear().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
