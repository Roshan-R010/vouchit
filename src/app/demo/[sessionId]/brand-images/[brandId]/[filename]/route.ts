import { db } from "@/lib/db";
import { readProductImage } from "@/lib/product-images";
import { isUuid } from "@/lib/brand";

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string; brandId: string; filename: string }> }) {
  const { sessionId, brandId, filename } = await params;
  if (!isUuid(sessionId) || !isUuid(brandId)) return new Response("Not found", { status: 404 });
  const logoUrl = `/demo/${sessionId}/brand-images/${brandId}/${filename}`;
  const brand = await db.brand.findFirst({ where: { id: brandId, demoSessionId: sessionId, logoUrl }, select: { id: true } });
  if (!brand) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readProductImage(sessionId, brandId, filename);
    const type = filename.endsWith(".jpg") ? "image/jpeg" : filename.endsWith(".png") ? "image/png" : "image/webp";
    return new Response(bytes, { headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable" } });
  } catch { return new Response("Not found", { status: 404 }); }
}
