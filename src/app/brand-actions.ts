"use server";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireBrand, isUuid } from "@/lib/brand";
import { dateOnly } from "@/lib/dates";
import { saveBrandLogo, saveProductImage, removeNewProductImage } from "@/lib/product-images";

export type BrandActionState = { error?: string; success?: string };
class FormError extends Error {}

function textField(form: FormData, key: string, max: number, required = false) {
  const value = String(form.get(key) ?? "").trim();
  if (required && !value) throw new FormError(`Please enter ${key === "name" ? "a name" : key === "serialNumber" ? "the stamped unit ID" : "the order reference"}.`);
  if (value.length > max) throw new FormError(`${key} must be ${max} characters or fewer.`);
  return value;
}

function productFields(form: FormData) {
  const name = textField(form, "name", 120, true);
  const sku = textField(form, "sku", 80) || null;
  const warrantyMonths = Number(form.get("warrantyMonths"));
  if (!Number.isInteger(warrantyMonths) || warrantyMonths < 1 || warrantyMonths > 120) throw new FormError("Warranty duration must be between 1 and 120 whole months.");
  return { name, sku, warrantyMonths };
}

function unitFields(form: FormData, optional = false) {
  const serialNumber = textField(form, "serialNumber", 100).toUpperCase();
  const orderNumber = textField(form, "orderNumber", 100);
  const delivery = textField(form, "deliveredOn", 10);
  if (optional && !serialNumber && !orderNumber && !delivery) return null;
  if (!serialNumber || !orderNumber) throw new FormError("Add both a stamped unit ID and an order reference.");
  let deliveredOn: Date | null = null;
  if (delivery) {
    deliveredOn = new Date(`${delivery}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(delivery) || Number.isNaN(deliveredOn.getTime()) || deliveredOn.toISOString().slice(0, 10) !== delivery) throw new FormError("Enter a valid delivery date.");
    if (deliveredOn > dateOnly(new Date())) throw new FormError("Delivery must be today or earlier. Leave it blank for an undelivered order.");
  }
  return { serialNumber, orderNumber, deliveredOn };
}

async function createUnit(tx: Prisma.TransactionClient, brandId: string, productModelId: string, values: NonNullable<ReturnType<typeof unitFields>>) {
  let order = await tx.purchaseOrder.findUnique({ where: { brandId_orderNumber: { brandId, orderNumber: values.orderNumber } } });
  if (order && order.deliveredOn?.getTime() !== values.deliveredOn?.getTime()) throw new FormError("That order already has a different delivery date. Use its recorded date or a different order reference.");
  if (!order) order = await tx.purchaseOrder.create({ data: { brandId, orderNumber: values.orderNumber, deliveredOn: values.deliveredOn } });
  return tx.productUnit.create({ data: { brandId, productModelId, purchaseOrderId: order.id, serialNumber: values.serialNumber } });
}

async function productImage(form: FormData, sessionId: string, productId: string, current: string | null) {
  if (form.get("removeImage") === "on") return { imageUrl: null, uploaded: false };
  const file = form.get("image");
  if (file instanceof File && file.size > 0) {
    try { return { imageUrl: await saveProductImage(sessionId, productId, file), uploaded: true }; }
    catch (error) { throw new FormError(error instanceof Error ? error.message : "The image could not be saved."); }
  }
  const url = textField(form, "imageUrl", 2048);
  if (!url) return { imageUrl: current, uploaded: false };
  if (url === current) return { imageUrl: current, uploaded: false };
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error();
  } catch { throw new FormError("Enter a full HTTPS image URL or choose an image file."); }
  return { imageUrl: url, uploaded: false };
}

function actionError(error: unknown): BrandActionState {
  if (error instanceof FormError) return { error: error.message };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "That unit ID is already assigned to a product. Enter its unique stamped ID." };
  return { error: "We couldn’t save this change. Please try again." };
}

function refreshWorkspace(sessionId: string) {
  revalidatePath(`/demo/${sessionId}`, "layout");
}

function brandSlug(name: string, id: string) {
  const base = name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "brand";
  return `${base}-${id.slice(0, 8)}`;
}

async function brandLogo(form: FormData, sessionId: string, brandId: string, current: string | null) {
  if (form.get("removeLogo") === "on") return { logoUrl: null, uploaded: false };
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) return { logoUrl: current, uploaded: false };
  try { return { logoUrl: await saveBrandLogo(sessionId, brandId, file), uploaded: true }; }
  catch (error) { throw new FormError(error instanceof Error ? error.message.replace("product image", "brand logo") : "The logo could not be saved."); }
}

export async function createBrandAction(sessionId: string, _state: BrandActionState, form: FormData): Promise<BrandActionState> {
  if (!isUuid(sessionId)) return { error: "Workspace not found." };
  const brandId = randomUUID();
  let uploadedUrl: string | null = null;
  try {
    const session = await db.demoSession.findUnique({ where: { id: sessionId }, select: { id: true } });
    if (!session) throw new FormError("Workspace not found.");
    const existing = await db.brand.findFirst({ where: { demoSessionId: sessionId }, select: { id: true } });
    if (existing) redirect(`/demo/${sessionId}/brand`);
    const name = textField(form, "name", 120, true);
    const supportEmail = textField(form, "supportEmail", 200) || null;
    if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) throw new FormError("Enter a valid support email address.");
    const logo = await brandLogo(form, sessionId, brandId, null);
    if (logo.uploaded) uploadedUrl = logo.logoUrl;
    await db.brand.create({ data: { id: brandId, demoSessionId: sessionId, name, slug: brandSlug(name, brandId), supportEmail, logoUrl: logo.logoUrl } });
  } catch (error) {
    if (uploadedUrl) await removeNewProductImage(uploadedUrl);
    return actionError(error);
  }
  refreshWorkspace(sessionId);
  redirect(`/demo/${sessionId}/brand`);
}

export async function createProductAction(sessionId: string, _state: BrandActionState, form: FormData): Promise<BrandActionState> {
  const brand = await requireBrand(sessionId);
  const productId = randomUUID();
  let uploadedUrl: string | null = null;
  try {
    const fields = productFields(form);
    const firstUnit = unitFields(form, true);
    const image = await productImage(form, sessionId, productId, null);
    if (image.uploaded) uploadedUrl = image.imageUrl;
    const baseSlug = fields.name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "product";
    await db.$transaction(async (tx) => {
      await tx.productModel.create({ data: { id: productId, brandId: brand.id, ...fields, imageUrl: image.imageUrl, slug: `${baseSlug}-${productId.slice(0, 8)}` } });
      if (firstUnit) await createUnit(tx, brand.id, productId, firstUnit);
    }, { timeout: 15000 });
  } catch (error) {
    if (uploadedUrl) await removeNewProductImage(uploadedUrl);
    return actionError(error);
  }
  refreshWorkspace(sessionId);
  redirect(`/demo/${sessionId}/brand/products/${productId}?created=1`);
}

export async function updateProductAction(sessionId: string, productId: string, _state: BrandActionState, form: FormData): Promise<BrandActionState> {
  const brand = await requireBrand(sessionId);
  if (!isUuid(productId)) return { error: "Product not found." };
  const product = await db.productModel.findFirst({ where: { id: productId, brandId: brand.id } });
  if (!product) return { error: "Product not found." };
  let uploadedUrl: string | null = null;
  try {
    const fields = productFields(form);
    const image = await productImage(form, sessionId, productId, product.imageUrl);
    if (image.uploaded) uploadedUrl = image.imageUrl;
    await db.productModel.update({ where: { id: productId, brandId: brand.id }, data: { ...fields, imageUrl: image.imageUrl } });
    if (product.imageUrl && product.imageUrl !== image.imageUrl) await removeNewProductImage(product.imageUrl);
  } catch (error) {
    if (uploadedUrl) await removeNewProductImage(uploadedUrl);
    return actionError(error);
  }
  refreshWorkspace(sessionId);
  redirect(`/demo/${sessionId}/brand/products/${productId}?updated=1`);
}

export async function addProductUnitAction(sessionId: string, productId: string, _state: BrandActionState, form: FormData): Promise<BrandActionState> {
  const brand = await requireBrand(sessionId);
  if (!isUuid(productId)) return { error: "Product not found." };
  const product = await db.productModel.findFirst({ where: { id: productId, brandId: brand.id }, select: { id: true } });
  if (!product) return { error: "Product not found." };
  try {
    const unit = unitFields(form);
    if (!unit) throw new FormError("Enter a unit ID and order reference.");
    await db.$transaction((tx) => createUnit(tx, brand.id, product.id, unit), { timeout: 15000 });
  } catch (error) { return actionError(error); }
  refreshWorkspace(sessionId);
  return { success: "Unit saved. The customer can register it using this product’s link once it is delivered." };
}

export async function updateBrandAction(sessionId: string, _state: BrandActionState, form: FormData): Promise<BrandActionState> {
  const brand = await requireBrand(sessionId);
  let uploadedUrl: string | null = null;
  try {
    const name = textField(form, "name", 120, true);
    const supportEmail = textField(form, "supportEmail", 200) || null;
    if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) throw new FormError("Enter a valid support email address.");
    const logo = await brandLogo(form, sessionId, brand.id, brand.logoUrl);
    if (logo.uploaded) uploadedUrl = logo.logoUrl;
    await db.brand.update({ where: { id: brand.id }, data: { name, supportEmail, logoUrl: logo.logoUrl } });
    if (brand.logoUrl && brand.logoUrl !== logo.logoUrl) await removeNewProductImage(brand.logoUrl);
  } catch (error) {
    if (uploadedUrl) await removeNewProductImage(uploadedUrl);
    return actionError(error);
  }
  refreshWorkspace(sessionId);
  return { success: "Brand details saved." };
}

export async function updateUnitDeliveryAction(sessionId: string, productId: string, unitId: string, _state: BrandActionState, form: FormData): Promise<BrandActionState> {
  const brand = await requireBrand(sessionId);
  if (!isUuid(productId) || !isUuid(unitId)) return { error: "Unit not found." };
  try {
    const deliveryForm = new FormData();
    deliveryForm.set("serialNumber", "validation");
    deliveryForm.set("orderNumber", "validation");
    deliveryForm.set("deliveredOn", String(form.get("deliveredOn") ?? ""));
    const deliveredOn = unitFields(deliveryForm)?.deliveredOn;
    if (!deliveredOn) throw new FormError("Enter the date this order was delivered.");
    await db.$transaction(async (tx) => {
      const unit = await tx.productUnit.findFirst({ where: { id: unitId, brandId: brand.id, productModelId: productId, purchaseOrder: { brandId: brand.id } }, include: { purchaseOrder: { include: { units: { select: { registration: { select: { id: true } } } } } } } });
      if (!unit) throw new FormError("Unit not found.");
      if (unit.purchaseOrder.deliveredOn || unit.purchaseOrder.units.some((item) => item.registration)) throw new FormError("This order already has recorded warranty dates and cannot be changed here.");
      const changed = await tx.purchaseOrder.updateMany({ where: { id: unit.purchaseOrderId, brandId: brand.id, deliveredOn: null }, data: { deliveredOn } });
      if (changed.count !== 1) throw new FormError("This order was already updated. Refresh to see its delivery date.");
    }, { timeout: 15000 });
  } catch (error) { return actionError(error); }
  refreshWorkspace(sessionId);
  return { success: "Delivery recorded for this order. Its units are now available for customer registration." };
}
