const MAX_ORIGINAL_BYTES = 50 * 1024 * 1024;
const MAX_STORED_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 1600;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type PreparedClaimPhoto = { name: string; dataUrl: string };

export async function prepareClaimPhoto(file: File): Promise<PreparedClaimPhoto> {
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error("Choose a JPG, PNG, or WebP photo.");
  if (!file.size || file.size > MAX_ORIGINAL_BYTES) throw new Error("This photo is too large to prepare in the browser (50 MB limit).");

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this photo.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let dataUrl = canvas.toDataURL("image/jpeg", .82);
    if ((dataUrl.length - dataUrl.indexOf(",") - 1) * .75 > MAX_STORED_BYTES) dataUrl = canvas.toDataURL("image/jpeg", .68);
    if ((dataUrl.length - dataUrl.indexOf(",") - 1) * .75 > MAX_STORED_BYTES) throw new Error("This photo is still too large after resizing. Choose a different one.");
    return { name: file.name, dataUrl };
  } finally {
    bitmap.close();
  }
}
