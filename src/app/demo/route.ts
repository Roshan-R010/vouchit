import { createDemoSession } from "@/lib/demo";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/brand";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const saved = (await cookies()).get("vouch-demo-session")?.value;
  const existing = saved && isUuid(saved) ? await db.demoSession.findUnique({ where: { id: saved }, select: { id: true } }) : null;
  const sessionId = existing?.id ?? await createDemoSession();
  const view = new URL(request.url).searchParams.get("view") === "brand" ? "brand" : "customer";
  const brand = await db.brand.findFirst({ where: { demoSessionId: sessionId }, select: { id: true } });
  const response = NextResponse.redirect(new URL(`/demo/${sessionId}/${brand ? view : "setup"}`, request.url));
  response.cookies.set("vouch-demo-session", sessionId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30, secure: new URL(request.url).protocol === "https:" });
  return response;
}
