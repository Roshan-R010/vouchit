import { resetDemoSession } from "@/lib/demo";
import { isUuid } from "@/lib/brand";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) return new Response("Demo session not found", { status: 404 });
  try { await resetDemoSession(sessionId); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return new Response("Demo session not found", { status: 404 });
    throw error;
  }
  return NextResponse.redirect(new URL(`/demo/${sessionId}/setup`, request.url), 303);
}
