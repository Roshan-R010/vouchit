import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { imageExtension, MAX_PRODUCT_IMAGE_BYTES } from "@/lib/product-images";

type ImageKind = "logos" | "claims";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const filenamePattern = /^[0-9a-f-]{36}\.(png|jpg|webp)$/i;
const bucket = "workspace-images";
let bucketReady: Promise<void> | undefined;

function storage() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url && !key) return null;
  if (!url || !key) throw new Error("Image storage configuration is incomplete.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function objectPath(sessionId: string, kind: ImageKind, ownerId: string, filename: string) {
  if (!uuid.test(sessionId) || !uuid.test(ownerId) || !filenamePattern.test(filename) || !["logos", "claims"].includes(kind)) throw new Error("Invalid image location.");
  return `${sessionId}/${kind}/${ownerId}/${filename}`;
}

export function validateWorkspaceImage(file: File) {
  if (!file.size || file.size > MAX_PRODUCT_IMAGE_BYTES) throw new Error("Each image must be between 1 byte and 5 MB.");
}

export async function saveWorkspaceImage(sessionId: string, kind: ImageKind, ownerId: string, file: File) {
  validateWorkspaceImage(file);
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = imageExtension(bytes);
  const filename = `${randomUUID()}.${ext}`;
  const key = objectPath(sessionId, kind, ownerId, filename);
  const client = storage();
  if (client) {
    bucketReady ??= (async () => {
      const { data, error } = await client.storage.getBucket(bucket);
      if (data) {
        if (data.public) throw new Error("The workspace-images bucket must be private.");
        return;
      }
      if (error && !/not found/i.test(error.message)) throw new Error("Could not connect to image storage.");
      const created = await client.storage.createBucket(bucket, { public: false, fileSizeLimit: MAX_PRODUCT_IMAGE_BYTES, allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"] });
      if (created.error && !/already exists/i.test(created.error.message)) throw new Error("Could not prepare image storage.");
    })().catch((error) => { bucketReady = undefined; throw error; });
    await bucketReady;
    const { error } = await client.storage.from(bucket).upload(key, bytes, { contentType: ext === "jpg" ? "image/jpeg" : `image/${ext}`, upsert: false });
    if (error) throw new Error("The image could not be uploaded. Please try again.");
  } else {
    const localPath = path.join(process.cwd(), ".vouch", "media", key);
    await mkdir(path.dirname(localPath), { recursive: true });
    await writeFile(localPath, bytes, { flag: "wx" });
  }
  return `/demo/${sessionId}/media/${kind}/${ownerId}/${filename}`;
}

export async function readWorkspaceImage(sessionId: string, kind: ImageKind, ownerId: string, filename: string) {
  const key = objectPath(sessionId, kind, ownerId, filename);
  const client = storage();
  if (client) {
    const { data, error } = await client.storage.from(bucket).download(key);
    if (error || !data) throw new Error("Image not found.");
    return new Uint8Array(await data.arrayBuffer());
  }
  return new Uint8Array(await readFile(path.join(process.cwd(), ".vouch", "media", key)));
}

export async function removeWorkspaceImage(url: string) {
  const parts = url.split("/");
  if (parts.length !== 7 || parts[1] !== "demo" || parts[3] !== "media" || !["logos", "claims"].includes(parts[4])) return;
  try {
    const key = objectPath(parts[2], parts[4] as ImageKind, parts[5], parts[6]);
    const client = storage();
    if (client) await client.storage.from(bucket).remove([key]);
    else await unlink(path.join(process.cwd(), ".vouch", "media", key));
  } catch { /* A failed cleanup must not undo a saved record. */ }
}
