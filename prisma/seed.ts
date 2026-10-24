import { createDemoSession } from "../src/lib/demo";
import { db } from "../src/lib/db";

async function seed() {
  return createDemoSession();
}

seed().then((id) => {
  console.log(`Created empty Vouch workspace: ${id}`);
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
