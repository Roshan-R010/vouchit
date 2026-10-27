import { db } from "../src/lib/db";
import { removeNewProductImage, removeSessionImages } from "../src/lib/product-images";
import { removeClaimImages } from "../server/claim-images";

async function clear() {
  const [products, brands, sessions, claimPhotos] = await Promise.all([
    db.productModel.findMany({ where: { imageUrl: { not: null } }, select: { imageUrl: true } }),
    db.brand.findMany({ where: { logoUrl: { not: null } }, select: { logoUrl: true } }),
    db.demoSession.findMany({ select: { id: true } }),
    db.claimAttachment.findMany({ select: { fileKey: true } }),
  ]);
  const result = await db.demoSession.deleteMany();
  const accounts = await db.account.deleteMany();
  await Promise.all([
    ...products.map(({ imageUrl }) => imageUrl && removeNewProductImage(imageUrl)),
    ...brands.map(({ logoUrl }) => logoUrl && removeNewProductImage(logoUrl)),
    ...sessions.map(({ id }) => removeSessionImages(id)),
    removeClaimImages(claimPhotos.map(({ fileKey }) => fileKey)),
  ]);
  console.log(`Cleared ${result.count} workspace(s), ${accounts.count} account(s), and uploaded images.`);
}

clear().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
