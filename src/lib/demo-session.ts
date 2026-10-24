import { db } from "@/lib/db";

export async function createDemoSession(sessionId?: string) {
  const session = await db.demoSession.create({ data: sessionId ? { id: sessionId } : {} });
  return session.id;
}
