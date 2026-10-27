import { randomUUID } from "node:crypto";
import { File } from "node:buffer";
import { createClient } from "@supabase/supabase-js";
import { imageExtension, MAX_PRODUCT_IMAGE_BYTES } from "../src/lib/product-images";

export const MAX_CLAIM_PHOTOS = 3;
export const MAX_CLAIM_IMAGE_BYTES = MAX_PRODUCT_IMAGE_BYTES;
const BUCKET = "workspace-images";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const filename = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/i;
let bucketReady: Promise<void> | undefined;

export class ClaimImageStorageError extends Error {}

function storage() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ClaimImageStorageError("Claim photo storage is not configured. Add SUPABASE_SECRET_KEY to the server environment.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ready() {
  const client = storage();
  bucketReady ??= (async () => {
    const { data, error } = await client.storage.getBucket(BUCKET);
    if (data) {
      if (data.public) throw new ClaimImageStorageError("The workspace-images bucket must be private.");
      return;
    }
    if (error && !/not found/i.test(error.message)) throw new ClaimImageStorageError("Could not connect to private claim photo storage.");
    const created = await client.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_CLAIM_IMAGE_BYTES,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    });
    if (created.error && !/already exists/i.test(created.error.message)) throw new ClaimImageStorageError("Could not prepare private claim photo storage.");
  })().catch(error => { bucketReady = undefined; throw error; });
  await bucketReady;
  return client;
}

function claimPath(sessionId: string, claimId: string, imageName: string) {
  if (!uuid.test(sessionId) || !uuid.test(claimId) || !filename.test(imageName)) throw new Error("Invalid claim photo path.");
  return `${sessionId}/claims/${claimId}/${imageName}`;
}

export async function saveClaimImage(sessionId: string, claimId: string, file: File) {
  if (!file.size || file.size > MAX_CLAIM_IMAGE_BYTES) throw new Error("Each claim photo must be 5 MB or smaller.");
  const bytes = Buffer.from(await file.arrayBuffer());
  let extension: string;
  try { extension = imageExtension(bytes); }
  catch { throw new Error("Choose a valid JPG, PNG, or WebP claim photo."); }
  const key = claimPath(sessionId, claimId, `${randomUUID()}.${extension}`);
  const client = await ready();
  const { error } = await client.storage.from(BUCKET).upload(key, bytes, {
    contentType: extension === "jpg" ? "image/jpeg" : `image/${extension}`,
    upsert: false,
  });
  if (error) throw new ClaimImageStorageError("Could not upload the claim photo. Please try again.");
  return key;
}

export async function readClaimImage(sessionId: string, claimId: string, key: string) {
  const imageName = key.split("/").at(-1) || "";
  if (claimPath(sessionId, claimId, imageName) !== key) throw new Error("Invalid claim photo path.");
  const client = await ready();
  const { data, error } = await client.storage.from(BUCKET).download(key);
  if (error || !data) throw new Error("Claim photo not found.");
  return { bytes: Buffer.from(await data.arrayBuffer()), contentType: imageName.endsWith(".jpg") ? "image/jpeg" : imageName.endsWith(".png") ? "image/png" : "image/webp" };
}

export async function removeClaimImages(keys: string[]) {
  if (!keys.length) return;
  try { await (await ready()).storage.from(BUCKET).remove(keys); } catch { /* Cleanup failure must not mask the claim error. */ }
}
