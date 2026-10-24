import { createDemoSession } from "../src/lib/demo-fixtures";
import { db } from "../src/lib/db";

async function seed() {
  const existing = await db.demoSession.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const id = existing?.id ?? await createDemoSession();
  await db.$transaction([
    db.productModel.updateMany({ where: { slug: "kestrel-pro", imageUrl: null, brand: { slug: "kestrel-audio" } }, data: { imageUrl: "/images/kestrel-pro-headphones.png" } }),
    db.productModel.updateMany({ where: { slug: "kestrel-charge-20k", imageUrl: null, brand: { slug: "kestrel-audio" } }, data: { imageUrl: "/images/kestrel-charge-powerbank.png" } }),
  ]);
  return id;
}

seed().then((id) => {
  console.log(`Created empty Vouch workspace: ${id}`);
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
