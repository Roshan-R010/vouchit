import { db } from "@/lib/db";
import { isUuid } from "@/lib/brand";
import { readWorkspaceImage } from "@/lib/workspace-images";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string; kind: string; ownerId: string; filename: string }> }) {
  const { sessionId, kind, ownerId, filename } = await params;
  if (!isUuid(sessionId) || !isUuid(ownerId) || !/^[0-9a-f-]{36}\.(png|jpg|webp)$/i.test(filename) || (kind !== "logos" && kind !== "claims")) return new Response("Image not found", { status: 404 });
  const url = `/demo/${sessionId}/media/${kind}/${ownerId}/${filename}`;
  const record = kind === "logos"
    ? await db.brand.findFirst({ where: { id: ownerId, demoSessionId: sessionId, logoUrl: url }, select: { id: true } })
    : await db.claimAttachment.findFirst({ where: { claimId: ownerId, fileKey: url, claim: { registration: { customer: { demoSessionId: sessionId }, unit: { brand: { demoSessionId: sessionId } } } } }, select: { id: true } });
  if (!record) return new Response("Image not found", { status: 404 });
  try {
    const bytes = await readWorkspaceImage(sessionId, kind, ownerId, filename);
    return new Response(bytes, { headers: { "Content-Type": filename.endsWith(".jpg") ? "image/jpeg" : filename.endsWith(".png") ? "image/png" : "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("Image not found", { status: 404 }); }
}
