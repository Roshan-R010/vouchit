import { createDemoSession } from "../src/lib/demo-session";
import { db } from "../src/lib/db";

async function seed() {
  const existing = await db.demoSession.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const id = existing?.id ?? await createDemoSession();
  return id;
}

seed().then((id) => {
  console.log(`Created Vouch demo session: ${id}`);
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
