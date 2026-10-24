import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const imagePattern = /^[0-9a-f-]{36}\.(png|jpg|webp)$/i;
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const STORAGE_BUCKET = "product-images";
let bucketReady: Promise<void> | undefined;

function storageConfig() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return { url, client: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) };
}

async function ensureBucket() {
  const config = storageConfig();
  if (!config) return null;
  bucketReady ??= (async () => {
    const { data } = await config.client.storage.getBucket(STORAGE_BUCKET);
    if (data) return;
    const { error } = await config.client.storage.createBucket(STORAGE_BUCKET, { public: true, fileSizeLimit: MAX_PRODUCT_IMAGE_BYTES, allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"] });
    if (error && !/already exists/i.test(error.message)) throw new Error(`Supabase Storage: ${error.message}`);
  })().catch((error) => { bucketReady = undefined; throw error; });
  await bucketReady;
  return config;
}

function imagePath(sessionId: string, assetId: string, filename: string) {
  if (!uuidPattern.test(sessionId) || !uuidPattern.test(assetId) || !imagePattern.test(filename)) {
    throw new Error("Invalid image location.");
  }
  return path.join(process.cwd(), ".vouch", "uploads", sessionId, assetId, filename);
}

export function imageExtension(bytes: Buffer) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpg";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  throw new Error("Choose a PNG, JPEG, or WebP product image.");
}

type ImageUpload = { size: number; arrayBuffer: () => Promise<ArrayBuffer> };

async function saveImage(sessionId: string, assetId: string, file: ImageUpload, route: "product-images" | "brand-images") {
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) throw new Error("The image must be 5 MB or smaller.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const extension = imageExtension(bytes);
  const filename = `${randomUUID()}.${extension}`;
  const storage = await ensureBucket();
  if (storage) {
    const objectPath = `${sessionId}/${assetId}/${filename}`;
    const contentType = extension === "jpg" ? "image/jpeg" : `image/${extension}`;
    const { error } = await storage.client.storage.from(STORAGE_BUCKET).upload(objectPath, bytes, { contentType, cacheControl: "31536000", upsert: false });
    if (error) throw new Error(`Supabase Storage: ${error.message}`);
    return storage.client.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath).data.publicUrl;
  }
  const filePath = imagePath(sessionId, assetId, filename);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes, { flag: "wx" });
  return `/demo/${sessionId}/${route}/${assetId}/${filename}`;
}

export async function saveProductImage(sessionId: string, productId: string, file: ImageUpload) {
  return saveImage(sessionId, productId, file, "product-images");
}

export async function saveBrandLogo(sessionId: string, brandId: string, file: ImageUpload) {
  return saveImage(sessionId, brandId, file, "brand-images");
}

export async function readProductImage(sessionId: string, productId: string, filename: string) {
  return readFile(imagePath(sessionId, productId, filename));
}

export async function removeNewProductImage(imageUrl: string) {
  const storage = storageConfig();
  const remotePrefix = storage ? `${storage.url}/storage/v1/object/public/${STORAGE_BUCKET}/` : "";
  if (storage && imageUrl.startsWith(remotePrefix)) {
    const objectPath = decodeURIComponent(imageUrl.slice(remotePrefix.length));
    if (/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/i.test(objectPath)) await storage.client.storage.from(STORAGE_BUCKET).remove([objectPath]).catch(() => undefined);
    return;
  }
  const parts = imageUrl.split("/");
  if (parts.length !== 6 || parts[1] !== "demo" || !["product-images", "brand-images"].includes(parts[3])) return;
  await unlink(imagePath(parts[2], parts[4], parts[5])).catch(() => undefined);
}

export async function removeSessionImages(sessionId: string) {
  if (!uuidPattern.test(sessionId)) throw new Error("Invalid image location.");
  const uploadsRoot = path.resolve(process.cwd(), ".vouch", "uploads");
  const sessionRoot = path.resolve(uploadsRoot, sessionId);
  if (path.dirname(sessionRoot) !== uploadsRoot) throw new Error("Invalid image location.");
  await rm(sessionRoot, { recursive: true, force: true });
}
