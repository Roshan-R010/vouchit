import { db } from "@/lib/db";
import { isUuid } from "@/lib/brand";
import { readProductImage } from "@/lib/product-images";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string; productId: string; filename: string }> }) {
  const { sessionId, productId, filename } = await params;
  if (!isUuid(sessionId) || !isUuid(productId) || !/^[0-9a-f-]{36}\.(png|jpg|webp)$/i.test(filename)) {
    return new Response("Image not found", { status: 404 });
  }
  const imageUrl = `/demo/${sessionId}/product-images/${productId}/${filename}`;
  const product = await db.productModel.findFirst({ where: { id: productId, imageUrl, brand: { demoSessionId: sessionId } }, select: { id: true } });
  if (!product) return new Response("Image not found", { status: 404 });
  try {
    const bytes = await readProductImage(sessionId, productId, filename);
    const type = filename.endsWith(".jpg") ? "image/jpeg" : filename.endsWith(".png") ? "image/png" : "image/webp";
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("Image not found", { status: 404 });
  }
}
