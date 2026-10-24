"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isUuid, requireBrand } from "@/lib/brand";
import { removeWorkspaceImage, saveWorkspaceImage } from "@/lib/workspace-images";

export type BrandProfileState = { error?: string; success?: string };

function profileFields(form: FormData) {
  const name = String(form.get("name") || "").trim();
  const supportEmail = String(form.get("supportEmail") || "").trim() || null;
  if (!name || name.length > 120) throw new Error("Enter a brand name of up to 120 characters.");
  if (supportEmail && (supportEmail.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail))) throw new Error("Enter a valid support email address.");
  return { name, supportEmail };
}

export async function createBrandAction(sessionId: string, _state: BrandProfileState, form: FormData): Promise<BrandProfileState> {
  if (!isUuid(sessionId)) redirect("/demo?view=brand");
  const session = await db.demoSession.findUnique({ where: { id: sessionId }, select: { id: true } });
  if (!session) redirect("/demo?view=brand");
  const id = randomUUID();
  let uploaded: string | null = null;
  try {
    const fields = profileFields(form);
    const logo = form.get("logo");
    if (logo instanceof File && logo.size) uploaded = await saveWorkspaceImage(sessionId, "logos", id, logo);
    const brand = await db.$transaction(async (tx) => {
      // Lock this workspace so simultaneous setup submissions create one brand.
      await tx.demoSession.update({ where: { id: sessionId }, data: { id: sessionId } });
      const existing = await tx.brand.findFirst({ where: { demoSessionId: sessionId } });
      if (existing) return existing;
      const slug = fields.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "brand";
      return tx.brand.create({ data: { id, demoSessionId: sessionId, ...fields, slug: `${slug}-${id.slice(0, 8)}`, logoUrl: uploaded } });
    }, { timeout: 15000 });
    if (brand.id !== id && uploaded) await removeWorkspaceImage(uploaded);
  } catch (error) {
    if (uploaded) await removeWorkspaceImage(uploaded);
    return { error: error instanceof Error && !error.message.includes("prisma") ? error.message : "The brand could not be created. Please try again." };
  }
  revalidatePath(`/demo/${sessionId}`, "layout");
  redirect(`/demo/${sessionId}/brand/products`);
}

export async function saveBrandProfileAction(sessionId: string, _state: BrandProfileState, form: FormData): Promise<BrandProfileState> {
  const brand = await requireBrand(sessionId);
  let uploaded: string | null = null;
  try {
    const fields = profileFields(form);
    let logoUrl = form.get("removeLogo") === "on" ? null : brand.logoUrl;
    const logo = form.get("logo");
    if (logo instanceof File && logo.size) logoUrl = uploaded = await saveWorkspaceImage(sessionId, "logos", brand.id, logo);
    await db.brand.update({ where: { id: brand.id }, data: { ...fields, logoUrl } });
    if (brand.logoUrl && brand.logoUrl !== logoUrl) await removeWorkspaceImage(brand.logoUrl);
  } catch (error) {
    if (uploaded) await removeWorkspaceImage(uploaded);
    return { error: error instanceof Error && !error.message.includes("prisma") ? error.message : "The brand could not be saved. Please try again." };
  }
  revalidatePath(`/demo/${sessionId}`, "layout");
  return { success: "Brand details and logo saved." };
}
