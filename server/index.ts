import { loadAnalytics } from "./analytics";
import { loadBrandDashboard, registrationAttentionWhere } from "./dashboard";
import { IssueTagValidationError, normalizeIssueTags, selectProductIssueTags } from "../src/lib/issue-tags";
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { File } from "node:buffer";
import { AccountRole, ActorRole, ClaimStatus, NotificationType, Prisma, RegistrationVerificationMode, ResolutionMethod } from "@prisma/client";
import { currentAccount, endSession, hashPassword, startSession, verifyPassword } from "./auth";
import { db } from "../src/lib/db";
import { requireBrand, isUuid } from "../src/lib/brand";
import { createDemoSession, resetDemoSession, sessionCustomer } from "../src/lib/demo";
import { addCalendarMonths, dateOnly, daysRemaining, formatDate, isCoverageActive } from "../src/lib/dates";
import { readProductImage, removeNewProductImage, saveBrandLogo, saveProductImage } from "../src/lib/product-images";
import { ClaimImageStorageError, MAX_CLAIM_PHOTOS, readClaimImage, removeClaimImages, saveClaimImage } from "./claim-images";
import { commitImport, parseSource, previewImport } from "./unit-import";
import { registrationEmail, startEmailWorker } from "./email";
import { changeUnitLifecycle } from "./unit-lifecycle";
import { commitBatch, planBatch } from "./advanced-import";
import { validProfileConfig } from "./import-profile";
import { updateClaimResolution } from "./claim-resolution";

// Automatically load environment variables if .env exists
try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
  }
} catch {
  // .env may not exist or already loaded
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3002;

app.use(cors());
app.use(express.json({ limit: "64mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/auth/me", async (req, res) => {
  const account = await currentAccount(req);
  res.json({ account: account && { id: account.id, role: account.role, displayName: account.displayName, demoSessionId: account.demoSessionId } });
});

app.post("/api/auth/signup", async (req, res) => {
  const role = req.body?.role === "BRAND" ? AccountRole.BRAND : req.body?.role === "CUSTOMER" ? AccountRole.CUSTOMER : null;
  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const displayName = String(req.body?.displayName || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!role || !/^[a-z0-9_.-]{3,32}$/.test(username) || password.length < 8 || password.length > 128 || !displayName || displayName.length > 100 || (role === AccountRole.CUSTOMER && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return res.status(400).json({ error: "Enter a name, a valid username (3–32 characters), a password of at least 8 characters, and an email for customer accounts." });
  }
  try {
    const passwordHash = await hashPassword(password);
    const account = await db.$transaction(async tx => {
      const workspace = role === AccountRole.BRAND ? await tx.demoSession.create({ data: {} }) : null;
      return tx.account.create({ data: { username, passwordHash, role, displayName, email: role === AccountRole.CUSTOMER ? email : null, demoSessionId: workspace?.id } });
    });
    await startSession(account.id, res);
    res.status(201).json({ account: { id: account.id, role, displayName, demoSessionId: account.demoSessionId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return res.status(409).json({ error: "This username or email is already in use." });
    console.error("Sign up failed:", error);
    res.status(500).json({ error: "Could not create account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const role = req.body?.role;
  try {
    const account = await db.account.findUnique({ where: { username } });
    if (!account || account.role !== role || !await verifyPassword(password, account.passwordHash)) return res.status(401).json({ error: "Incorrect username or password." });
    await startSession(account.id, res);
    const hasBrand = account.demoSessionId ? await db.brand.count({ where: { demoSessionId: account.demoSessionId } }) > 0 : false;
    res.json({ account: { id: account.id, role: account.role, displayName: account.displayName, demoSessionId: account.demoSessionId }, hasBrand });
  } catch (error) {
    console.error("Login failed:", error);
    res.status(500).json({ error: "Could not sign in." });
  }
});

app.post("/api/auth/logout", async (req, res) => { await endSession(req, res); res.json({ success: true }); });

app.get("/api/account/customer/settings", async (req, res) => {
  const account = await currentAccount(req);
  if (!account || account.role !== AccountRole.CUSTOMER) return res.status(401).json({ error: "Please sign in as a customer." });
  res.json({ email: account.email ?? "" });
});

app.put("/api/account/customer/settings", async (req, res) => {
  const account = await currentAccount(req);
  if (!account || account.role !== AccountRole.CUSTOMER) return res.status(401).json({ error: "Please sign in as a customer." });
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  try {
    await db.$transaction(async tx => {
      await tx.account.update({ where: { id: account.id }, data: { email } });
      await tx.customer.updateMany({ where: { accountId: account.id }, data: { email } });
    });
    res.json({ email });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return res.status(409).json({ error: "This email address is already in use." });
    res.status(500).json({ error: "Could not save your email. Please try again." });
  }
});

app.get("/api/account/customer", async (req, res) => {
  const account = await currentAccount(req);
  if (!account || account.role !== AccountRole.CUSTOMER) return res.status(401).json({ error: "Please sign in as a customer." });
  try {
    const registrations = await db.warrantyRegistration.findMany({
      where: { active: true, customer: { accountId: account.id } },
      include: { unit: { include: { productModel: true, brand: true } }, sale: { include: { purchaseOrder: true } }, claim: { include: { addressRequest: { select: { receivedAt: true } } } } },
      orderBy: { registeredAt: "desc" },
    });
    const notificationRegistrations = await db.warrantyRegistration.findMany({ where: { customer: { accountId: account.id } }, select: { id: true, claim: { select: { id: true } } } });
    const notificationIds = notificationRegistrations.flatMap(item => [item.id, ...(item.claim ? [item.claim.id] : [])]);
    res.json({
      customer: { name: account.displayName, email: account.email },
      brand: { name: "Vouch", slug: "", logoUrl: null },
      availableProducts: [],
      warranties: registrations.map(r => {
        const remainingDays = daysRemaining(r.coverageEndsOn);
        return {
          registrationId: r.id, unitId: r.unitId, demoSessionId: r.unit.brand.demoSessionId,
          productModelId: r.unit.productModelId, serialNumber: r.unit.serialNumber,
          productName: r.unit.productModel.name, imageUrl: r.unit.productModel.imageUrl,
          brandName: r.unit.brand.name, warrantyMonths: r.unit.productModel.warrantyMonths,
          coverageStartsOn: r.coverageStartsOn, coverageEndsOn: r.coverageEndsOn,
          isActive: isCoverageActive(r.coverageEndsOn), daysRemaining: remainingDays,
          progressPercent: Math.max(0, Math.min(100, Math.round(remainingDays / (r.unit.productModel.warrantyMonths * 30.5) * 100))),
          orderNumber: r.sale?.purchaseOrder.orderNumber ?? null, deliveredOn: r.sale?.confirmedDeliveredOn ?? null,
          claim: r.claim ? { id: r.claim.id, reference: r.claim.reference, status: r.claim.status, issueTitle: r.claim.issueTitle, submittedAt: r.claim.submittedAt, addressNeeded: !!r.claim.addressRequest && !r.claim.addressRequest.receivedAt } : null,
        };
      }),
      notifications: await db.demoNotification.findMany({ where: { recipientLabel: "Customer", relatedId: { in: notificationIds } }, orderBy: { createdAt: "desc" }, take: 10 }),
    });
  } catch (error) {
    console.error("Customer account error:", error);
    res.status(500).json({ error: "Could not load your warranties." });
  }
});

// The product page is public so a shared link opens before login. Every account
// view and write below this point is scoped to the authenticated role and owner.
app.use("/api/demo/:sessionId", async (req, res, next) => {
  if (req.method === "GET" && /^\/register\/[^/]+\/[^/]+$/.test(req.path)) return next();
  const account = await currentAccount(req);
  if (!account) return res.status(401).json({ error: "Please sign in to continue." });
  if (req.path.startsWith("/brand") || req.path === "/reset") {
    if (account.role !== AccountRole.BRAND || account.demoSessionId !== req.params.sessionId) return res.status(403).json({ error: "This brand workspace is not yours." });
  } else if (req.path.startsWith("/customer") || req.path === "/register") {
    if (account.role !== AccountRole.CUSTOMER) return res.status(403).json({ error: "Please use a customer account." });
  } else if (req.path === "/session") {
    return res.status(403).json({ error: "Use your account to open a workspace." });
  }
  res.locals.account = account;
  next();
});

// Helper: safe session ID validation
function checkSessionId(req: express.Request, res: express.Response): string | null {
  const sessionId = req.params.sessionId || req.body?.sessionId || req.query?.sessionId;
  if (!sessionId || !isUuid(String(sessionId))) {
    res.status(400).json({ error: "Invalid or missing session ID" });
    return null;
  }
  return String(sessionId);
}

function imageFromDataUrl(value: unknown, label: string): File | null {
  if (!value) return null;
  if (typeof value !== "string") throw new Error(`Choose a valid ${label}.`);
  const match = /^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(value);
  if (!match) throw new Error(`Choose a PNG, JPEG, or WebP ${label}.`);
  const bytes = Buffer.from(match[3].replace(/\s/g, ""), "base64");
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error(`The ${label} must be 5 MB or smaller.`);
  const extension = match[1].toLowerCase() === "image/jpeg" ? "jpg" : match[1].split("/")[1];
  return new File([bytes], `upload.${extension}`, { type: match[1].toLowerCase() });
}

function makeSlug(name: string, id: string) {
  const base = name.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "brand";
  return `${base}-${id.slice(0, 8)}`;
}

// -------------------------------------------------------------
// SESSIONS & DEMO LIFECYCLE
// -------------------------------------------------------------

// Create or retrieve session
app.post("/api/demo/session", async (req, res) => {
  try {
    const requested = req.body?.sessionId;
    if (requested && isUuid(requested)) {
      const existing = await db.demoSession.findUnique({ where: { id: requested } });
      if (existing) {
        const hasBrand = await db.brand.count({ where: { demoSessionId: existing.id } });
        return res.json({ sessionId: existing.id, hasBrand: hasBrand > 0 });
      }
    }
    const sessionId = await createDemoSession();
    res.json({ sessionId, hasBrand: false });
  } catch (error) {
    console.error("Error creating demo session:", error);
    res.status(500).json({ error: "Failed to initialize demo session" });
  }
});

app.post("/api/demo/:sessionId/brand/setup", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  let uploadedLogo: string | null = null;
  try {
    const name = String(req.body?.name || "").trim();
    const supportEmail = String(req.body?.supportEmail || "").trim() || null;
    if (!name || name.length > 120) return res.status(400).json({ error: "Enter a brand name of 120 characters or fewer." });
    if (supportEmail && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail) || supportEmail.length > 200)) return res.status(400).json({ error: "Enter a valid support email." });
    const session = await db.demoSession.findUnique({ where: { id: sessionId }, select: { id: true } });
    if (!session) return res.status(404).json({ error: "Workspace not found." });
    if (await db.brand.findFirst({ where: { demoSessionId: sessionId }, select: { id: true } })) return res.status(409).json({ error: "This workspace already has a brand." });
    const brandId = randomUUID();
    const logo = imageFromDataUrl(req.body?.logoDataUrl, "brand logo");
    if (logo) uploadedLogo = await saveBrandLogo(sessionId, brandId, logo);
    const brand = await db.brand.create({ data: { id: brandId, demoSessionId: sessionId, name, slug: makeSlug(name, brandId), supportEmail, logoUrl: uploadedLogo } });
    res.status(201).json({ brand });
  } catch (error: any) {
    if (uploadedLogo) await removeNewProductImage(uploadedLogo);
    res.status(400).json({ error: error.message || "Failed to create brand." });
  }
});

// Reset demo session
app.post("/api/demo/:sessionId/reset", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  try {
    const newSessionId = await resetDemoSession(sessionId);
    res.json({ success: true, sessionId: newSessionId });
  } catch (error) {
    console.error("Error resetting demo session:", error);
    res.status(500).json({ error: "Failed to reset demo session" });
  }
});

// -------------------------------------------------------------
// BRAND WORKSPACE APIS
// -------------------------------------------------------------

// Brand Dashboard
app.get("/api/demo/:sessionId/brand/notifications", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  try {
    const brand = await requireBrand(sessionId);
    const notifications = await db.demoNotification.findMany({
      where: { demoSessionId: sessionId, type: NotificationType.CLAIM_SUBMITTED_BRAND, recipientLabel: brand.name },
      orderBy: { createdAt: "desc" }, take: 5,
      select: { id: true, subject: true, previewBody: true, relatedId: true, createdAt: true },
    });
    res.json({ notifications });
  } catch (error) {
    console.error("Brand notifications error:", error);
    res.status(500).json({ error: "Could not load notifications." });
  }
});

app.get("/api/demo/:sessionId/brand", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  try {
    const brand = await requireBrand(sessionId);
    const periodDays = req.query.days === "7" ? 7 : req.query.days === "90" ? 90 : 30;
    res.json({ brand, ...await loadBrandDashboard(brand.id, sessionId, periodDays) });
  } catch (error) {
    console.error("Brand dashboard error:", error);
    res.status(500).json({ error: "Could not load your dashboard. Please try again." });
  }
});

// Brand Claims List
app.get("/api/demo/:sessionId/brand/claims", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  try {
    const brand = await requireBrand(sessionId);
    const { status, product, search, tag } = req.query;
    const selectedTags = (Array.isArray(tag) ? tag : tag ? [tag] : [])
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value, index, values) => value && values.indexOf(value) === index)
      .slice(0, 30);

    const where: Prisma.WarrantyClaimWhereInput = {
      registration: {
        unit: {
          brandId: brand.id,
          brand: { demoSessionId: sessionId },
          ...(product && typeof product === "string" ? { productModelId: product } : {}),
        },
        customer: { demoSessionId: sessionId },
      },
    };

    if (selectedTags.length) where.issueTags = { hasSome: selectedTags };

    if (status && typeof status === "string") {
      if (status === "open") {
        where.status = { in: [ClaimStatus.SUBMITTED, ClaimStatus.UNDER_REVIEW, ClaimStatus.INFO_REQUESTED] };
      } else if (status === "needs_review") {
        where.status = ClaimStatus.SUBMITTED;
      } else if (status === "in_review") {
        where.status = ClaimStatus.UNDER_REVIEW;
      } else if (status === "resolved") {
        where.status = ClaimStatus.RESOLVED;
      } else if (status === "rejected") {
        where.status = ClaimStatus.REJECTED;
      } else if (Object.values(ClaimStatus).includes(status as ClaimStatus)) {
        where.status = status as ClaimStatus;
      }
    }

    if (search && typeof search === "string" && search.trim()) {
      const q = search.trim();
      where.OR = [
        { reference: { contains: q, mode: "insensitive" } },
        { issueTitle: { contains: q, mode: "insensitive" } },
        { registration: { sale: { purchaseOrder: { orderNumber: { contains: q, mode: "insensitive" } } } } },
        { registration: { customer: { email: { contains: q, mode: "insensitive" } } } },
        { registration: { unit: { serialNumber: { contains: q, mode: "insensitive" } } } },
        { registration: { customer: { name: { contains: q, mode: "insensitive" } } } },
      ];
    }

    const [claims, products, allCounts] = await Promise.all([
      db.warrantyClaim.findMany({
        where,
        include: {
          registration: {
            include: {
              customer: true,
              sale: { include: { purchaseOrder: true } },
              unit: { include: { productModel: true, purchaseOrder: true } },
            },
          },
        },
        orderBy: { submittedAt: "desc" },
      }),
      db.productModel.findMany({
        where: { brandId: brand.id },
        select: { id: true, name: true, issueTags: true },
        orderBy: { name: "asc" },
      }),
      db.warrantyClaim.findMany({
        where: {
          registration: {
            unit: { brandId: brand.id, brand: { demoSessionId: sessionId } },
            customer: { demoSessionId: sessionId },
          },
        },
        select: { status: true },
      }),
    ]);

    const counts = {
      all: allCounts.length,
      needs_review: allCounts.filter((c) => c.status === ClaimStatus.SUBMITTED).length,
      approved: allCounts.filter((c) => c.status === ClaimStatus.APPROVED).length,
      in_review: allCounts.filter((c) => c.status === ClaimStatus.UNDER_REVIEW).length,
      open: allCounts.filter((c) => ([ClaimStatus.SUBMITTED, ClaimStatus.UNDER_REVIEW, ClaimStatus.INFO_REQUESTED] as ClaimStatus[]).includes(c.status)).length,
      resolved: allCounts.filter((c) => c.status === ClaimStatus.RESOLVED).length,
      rejected: allCounts.filter((c) => c.status === ClaimStatus.REJECTED).length,
    };

    res.json({
      claims: claims.map((c) => ({
        id: c.id,
        reference: c.reference,
        status: c.status,
        requiresReturnReview: c.requiresReturnReview,
        issueTitle: c.issueTitle,
        description: c.description,
        issueTags: c.issueTags,
        submittedAt: c.submittedAt,
        resolutionMethod: c.resolutionMethod,
        customer: {
          name: c.registration.customer.name,
          email: c.registration.customer.email,
        },
        unit: {
          serialNumber: c.registration.unit.serialNumber,
          productModel: c.registration.unit.productModel.name,
          imageUrl: c.registration.unit.productModel.imageUrl,
          sku: c.registration.unit.productModel.sku,
          orderNumber: c.registration.sale?.purchaseOrder.orderNumber ?? null,
          deliveredOn: c.registration.sale?.confirmedDeliveredOn ?? null,
        },
        coverageEndsOn: c.registration.coverageEndsOn,
      })),
      products,
      counts,
    });
  } catch (error: any) {
    console.error("Brand claims list error:", error);
    res.status(500).json({ error: error.message || "Failed to load claims" });
  }
});

// Brand Single Claim Detail
app.get("/api/demo/:sessionId/brand/claims/:claimId", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  const { claimId } = req.params;
  try {
    const brand = await requireBrand(sessionId);
    const claim = await db.warrantyClaim.findFirst({
      where: {
        id: claimId,
        registration: {
          unit: { brandId: brand.id, brand: { demoSessionId: sessionId } },
          customer: { demoSessionId: sessionId },
        },
      },
      include: {
        registration: {
          include: {
            customer: true,
            sale: { include: { purchaseOrder: true } },
            unit: { include: { productModel: true, purchaseOrder: true } },
          },
        },
        events: { orderBy: { createdAt: "asc" } },
        messages: { orderBy: { createdAt: "asc" } },
        attachments: { select: { id: true, createdAt: true }, orderBy: { createdAt: "asc" } },
        addressRequest: true,
        resolution: { include: { replacementUnit: { select: { serialNumber: true } }, events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } } },
      },
    });

    if (!claim) {
      return res.status(404).json({ error: "Claim not found" });
    }

    res.json({ claim: { ...claim, registration: { ...claim.registration, unit: { ...claim.registration.unit, purchaseOrder: claim.registration.sale?.purchaseOrder ?? null } } } });
  } catch (error: any) {
    console.error("Brand claim detail error:", error);
    res.status(500).json({ error: error.message || "Failed to load claim detail" });
  }
});

// Claim photos are private. Every read is checked against the signed-in brand or customer.
app.get("/api/demo/:sessionId/claim-photos/:claimId/:attachmentId", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  if (!isUuid(req.params.claimId) || !isUuid(req.params.attachmentId)) return res.status(404).end();
  try {
    const attachment = await db.claimAttachment.findFirst({
      where: { id: req.params.attachmentId, claimId: req.params.claimId, claim: { registration: { unit: { brand: { demoSessionId: sessionId } } } } },
      include: { claim: { include: { registration: { include: { customer: true } } } } },
    });
    const account = res.locals.account;
    const canView = attachment && (
      (account.role === AccountRole.BRAND && account.demoSessionId === sessionId) ||
      (account.role === AccountRole.CUSTOMER && attachment.claim.registration.customer.accountId === account.id)
    );
    if (!canView) return res.status(404).end();
    const image = await readClaimImage(sessionId, req.params.claimId, attachment.fileKey);
    res.set("Cache-Control", "private, max-age=300");
    res.set("X-Content-Type-Options", "nosniff");
    res.type(image.contentType).send(image.bytes);
  } catch (error) {
    console.error("Claim photo read failed:", error);
    res.status(404).end();
  }
});

// Brand Claim Status Action
app.post("/api/demo/:sessionId/brand/claims/:claimId/action", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  const { claimId } = req.params;
  const { decision, note } = req.body;

  const transitions: Record<string, { from: ClaimStatus; to: ClaimStatus; note: string }> = {
    review: { from: ClaimStatus.SUBMITTED, to: ClaimStatus.UNDER_REVIEW, note: "The brand started reviewing this claim." },
    approve: { from: ClaimStatus.UNDER_REVIEW, to: ClaimStatus.APPROVED, note: "The brand approved this claim." },
    reject: { from: ClaimStatus.UNDER_REVIEW, to: ClaimStatus.REJECTED, note: "The brand rejected this claim." },
    request_info: { from: ClaimStatus.UNDER_REVIEW, to: ClaimStatus.INFO_REQUESTED, note: "The brand requested more information." },
  };

  const transition = transitions[decision];
  if (!transition) {
    return res.status(400).json({ error: "Invalid claim decision action." });
  }

  const cleanNote = String(note || "").trim();
  if (cleanNote.length > 2000) {
    return res.status(400).json({ error: "Keep your message under 2,000 characters." });
  }
  if (["reject", "request_info"].includes(decision) && !cleanNote) {
    return res.status(400).json({
      error:
        decision === "request_info"
          ? "Enter the question you want the customer to answer."
          : "Enter a reason for rejecting this claim.",
    });
  }

  try {
    const brand = await requireBrand(sessionId);
    const scope = {
      id: claimId,
      registration: {
        customer: { demoSessionId: sessionId },
        unit: { brandId: brand.id, brand: { demoSessionId: sessionId } },
      },
    };

    const updated = await db.$transaction(async (tx) => {
      const claim = await tx.warrantyClaim.findFirst({
        where: scope,
        include: { addressRequest: true, registration: { include: { customer: true, unit: { include: { productModel: true } } } } },
      });
      if (!claim) throw new Error("This claim could not be found.");
      if (claim.status !== transition.from) throw new Error("This claim status has changed. Refresh to see latest status.");

      const changed = await tx.warrantyClaim.updateMany({
        where: { ...scope, status: transition.from },
        data: {
          status: transition.to,
        },
      });

      if (changed.count !== 1) throw new Error("This claim was updated by another request. Refresh to see its current status.");
      await tx.claimEvent.create({
        data: {
          claimId,
          actor: ActorRole.BRAND,
          fromStatus: transition.from,
          toStatus: transition.to,
          note: cleanNote || transition.note,
        },
      });

      if (decision === "request_info" && cleanNote) {
        await tx.claimMessage.create({
          data: {
            claimId,
            author: ActorRole.BRAND,
            body: cleanNote,
          },
        });
      }

      return claim;
    });

    const messages: Record<string, string> = { UNDER_REVIEW: "Review started.", APPROVED: "Claim approved. Start a resolution to track the outcome.", REJECTED: "Claim rejected. The reason is recorded in the claim history.", INFO_REQUESTED: "Information requested. The customer can reply from their claim page." };
    res.json({ success: true, message: messages[transition.to] });
  } catch (error: any) {
    console.error("Brand claim action error:", error);
    res.status(400).json({ error: error.message || "Failed to update claim" });
  }
});

app.post("/api/demo/:sessionId/brand/claims/:claimId/resolution", async (req, res) => {
  const sessionId = checkSessionId(req, res); if (!sessionId) return;
  if (!isUuid(req.params.claimId)) return res.status(400).json({ error: "Invalid claim." });
  try {
    const brand = await requireBrand(sessionId);
    const result = await updateClaimResolution(brand.id, sessionId, req.params.claimId, res.locals.account.id, req.body);
    res.json({ success: true, ...result });
  } catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : "Could not update resolution." }); }
});

// Approved repair or replacement resolutions can request an address without changing claim status.
app.post("/api/demo/:sessionId/brand/claims/:claimId/request-address", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  if (!isUuid(req.params.claimId)) return res.status(400).json({ error: "Invalid claim." });
  const requestedMethod = req.body?.resolutionMethod;
  if (requestedMethod !== ResolutionMethod.REPAIR && requestedMethod !== ResolutionMethod.REPLACEMENT) return res.status(400).json({ error: "Choose repair or replacement." });
  try {
    const brand = await requireBrand(sessionId);
    const result = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "WarrantyClaim" WHERE id = ${req.params.claimId}::uuid FOR UPDATE`;
      const claim = await tx.warrantyClaim.findFirst({ where: { id: req.params.claimId, registration: { unit: { brandId: brand.id } } }, include: { addressRequest: true, resolution: true } });
      if (!claim) throw new Error("Claim not found.");
      if (claim.status !== ClaimStatus.APPROVED) throw new Error("Only approved claims can request an address.");
      if (claim.resolution?.status !== "IN_PROGRESS" || claim.resolution.type !== requestedMethod) throw new Error("Start a matching repair or replacement resolution first.");
      if (claim.addressRequest) return { alreadyRequested: true };
      await tx.claimAddress.create({ data: { claimId: claim.id } });
      await tx.claimEvent.create({ data: { claimId: claim.id, actor: ActorRole.BRAND, fromStatus: ClaimStatus.APPROVED, toStatus: ClaimStatus.APPROVED, note: "Customer address requested." } });
      return { alreadyRequested: false };
    });
    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return res.status(409).json({ error: "Address request already sent. Refresh the claim." });
    res.status(409).json({ error: error instanceof Error ? error.message : "Could not request the address." });
  }
});

// Brand Products Catalog
app.post("/api/demo/:sessionId/brand/unit-import/batch/preview", async (req, res) => {
  const sessionId = checkSessionId(req, res); if (!sessionId) return;
  try { const brand = await requireBrand(sessionId); res.json(await planBatch(brand.id, req.body)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Could not preview the files." }); }
});

app.post("/api/demo/:sessionId/brand/unit-import/batch/commit", async (req, res) => {
  const sessionId = checkSessionId(req, res); if (!sessionId) return;
  try { const brand = await requireBrand(sessionId); res.json(await commitBatch(brand.id, res.locals.account.id, req.body)); }
  catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : "Could not import the files." }); }
});

app.get("/api/demo/:sessionId/brand/unit-import/profiles", async (req, res) => {
  const sessionId = checkSessionId(req, res); if (!sessionId) return;
  try { const brand = await requireBrand(sessionId); res.json({ profiles: await db.importProfile.findMany({ where: { brandId: brand.id }, orderBy: { updatedAt: "desc" } }) }); }
  catch { res.status(500).json({ error: "Could not load import profiles." }); }
});

app.post("/api/demo/:sessionId/brand/unit-import/profiles", async (req, res) => {
  const sessionId = checkSessionId(req, res); if (!sessionId) return;
  try {
    const brand = await requireBrand(sessionId);
    const name = String(req.body?.name ?? "").trim();
    if (!name || name.length > 100) return res.status(400).json({ error: "Enter a profile name up to 100 characters." });
    const config = validProfileConfig(req.body?.config);
    const profile = await db.importProfile.create({ data: { brandId: brand.id, name, importType: config.importType, config } });
    res.status(201).json({ profile });
  } catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : "Could not save profile." }); }
});

app.put("/api/demo/:sessionId/brand/unit-import/profiles/:profileId", async (req, res) => {
  const sessionId = checkSessionId(req, res); if (!sessionId) return;
  if (!isUuid(req.params.profileId)) return res.status(400).json({ error: "Invalid profile." });
  try {
    const brand = await requireBrand(sessionId);
    const existing = await db.importProfile.findFirst({ where: { id: req.params.profileId, brandId: brand.id } });
    if (!existing) return res.status(404).json({ error: "Profile not found." });
    const name = String(req.body?.name ?? existing.name).trim();
    if (!name || name.length > 100) return res.status(400).json({ error: "Enter a profile name up to 100 characters." });
    const config = req.body?.config ? validProfileConfig(req.body.config) : null;
    const profile = await db.importProfile.update({ where: { id: existing.id }, data: { name, ...(config ? { config, importType: config.importType, version: { increment: 1 } } : {}) } });
    res.json({ profile });
  } catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : "Could not update profile." }); }
});

app.delete("/api/demo/:sessionId/brand/unit-import/profiles/:profileId", async (req, res) => {
  const sessionId = checkSessionId(req, res); if (!sessionId) return;
  if (!isUuid(req.params.profileId)) return res.status(400).json({ error: "Invalid profile." });
  try { const brand = await requireBrand(sessionId); await db.importProfile.deleteMany({ where: { id: req.params.profileId, brandId: brand.id } }); res.json({ success: true }); }
  catch { res.status(500).json({ error: "Could not delete profile." }); }
});

app.post("/api/demo/:sessionId/brand/unit-import/parse", async (req, res) => {
  const sessionId = checkSessionId(req, res); if (!sessionId) return;
  try { await requireBrand(sessionId); res.json(await parseSource(req.body)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Could not read the file." }); }
});

app.post("/api/demo/:sessionId/brand/unit-import/preview", async (req, res) => {
  const sessionId = checkSessionId(req, res); if (!sessionId) return;
  try { const brand = await requireBrand(sessionId); res.json(await previewImport(brand.id, req.body)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Could not preview the import." }); }
});

app.post("/api/demo/:sessionId/brand/unit-import/commit", async (req, res) => {
  const sessionId = checkSessionId(req, res); if (!sessionId) return;
  try { const brand = await requireBrand(sessionId); res.json(await commitImport(brand.id, res.locals.account.id, req.body)); }
  catch (error) { console.error("Unit import failed:", error); res.status(400).json({ error: error instanceof Error && /no new valid units/i.test(error.message) ? error.message : "Import could not be completed. Refresh the preview and try again." }); }
});

app.get("/api/demo/:sessionId/brand/unit-import/history", async (req, res) => {
  const sessionId = checkSessionId(req, res); if (!sessionId) return;
  try { const brand = await requireBrand(sessionId); res.json({ imports: await db.unitImport.findMany({ where: { brandId: brand.id }, orderBy: { createdAt: "desc" }, take: 20 }) }); }
  catch { res.status(500).json({ error: "Could not load import history." }); }
});

app.get("/api/demo/:sessionId/brand/products", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  try {
    const brand = await requireBrand(sessionId);
    const products = await db.productModel.findMany({ where: { brandId: brand.id }, include: { _count: { select: { units: true } } }, orderBy: { name: "asc" } });
    const registered = await db.productUnit.groupBy({ by: ["productModelId"], where: { brandId: brand.id, registration: { isNot: null } }, _count: { id: true } });
    const registeredCounts = new Map(registered.map(row => [row.productModelId, row._count.id]));

    res.json({ brand, products: products.map(product => ({ ...product, unitCount: product._count.units, registeredCount: registeredCounts.get(product.id) ?? 0 })) });
  } catch (error: any) {
    console.error("Brand products error:", error);
    res.status(500).json({ error: error.message || "Failed to load products" });
  }
});

app.get("/api/demo/:sessionId/brand/products/:productId/units", async (req, res) => {
  const sessionId = checkSessionId(req, res); if (!sessionId) return;
  if (!isUuid(req.params.productId)) return res.status(400).json({ error: "Invalid product." });
  try {
    const brand = await requireBrand(sessionId);
    const product = await db.productModel.findFirst({ where: { id: req.params.productId, brandId: brand.id }, select: { id: true } });
    if (!product) return res.status(404).json({ error: "Product not found." });
    const page = Math.min(100000, Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1));
    const size = Math.min(100, Math.max(10, Number.parseInt(String(req.query.size ?? "25"), 10) || 25));
    const search = String(req.query.search ?? "").trim().slice(0, 120);
    const where: Prisma.ProductUnitWhereInput = { brandId: brand.id, productModelId: product.id, ...(search ? { serialNumber: { contains: search.toUpperCase() } } : {}) };
    const [total, registered, units] = await Promise.all([
      db.productUnit.count({ where }),
      db.productUnit.count({ where: { brandId: brand.id, productModelId: product.id, registration: { isNot: null } } }),
      db.productUnit.findMany({ where, include: { purchaseOrder: true, registration: { select: { id: true } }, sales: { where: { isCurrent: true }, select: { confirmedDeliveredOn: true, expectedDeliveryOn: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * size, take: size }),
    ]);
    res.json({ units, total, registered, page, size });
  } catch { res.status(500).json({ error: "Could not load units." }); }
});

app.get("/api/demo/:sessionId/brand/units/search", async (req, res) => {
  const sessionId = checkSessionId(req, res); if (!sessionId) return;
  const search = String(req.query.q ?? "").trim().slice(0, 120).toUpperCase();
  if (search.length < 2) return res.json({ units: [] });
  try {
    const brand = await requireBrand(sessionId);
    const units = await db.productUnit.findMany({ where: { brandId: brand.id, serialNumber: { contains: search } }, select: { id: true, serialNumber: true, status: true, productModel: { select: { name: true } }, purchaseOrder: { select: { orderNumber: true } }, registration: { select: { id: true } } }, orderBy: { serialNumber: "asc" }, take: 20 });
    res.json({ units });
  } catch { res.status(500).json({ error: "Could not search units." }); }
});

app.get("/api/demo/:sessionId/brand/units/:unitId/history", async (req, res) => {
  const sessionId = checkSessionId(req, res); if (!sessionId) return;
  if (!isUuid(req.params.unitId)) return res.status(400).json({ error: "Invalid unit." });
  try {
    const brand = await requireBrand(sessionId);
    const unit = await db.productUnit.findFirst({ where: { id: req.params.unitId, brandId: brand.id }, include: { productModel: { select: { name: true } }, purchaseOrder: { select: { orderNumber: true } }, registration: { select: { id: true, coverageStartsOn: true, coverageEndsOn: true } }, sales: { orderBy: { createdAt: "desc" }, include: { purchaseOrder: { select: { orderNumber: true } } } }, events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] }, registrations: { select: { id: true, active: true, registeredAt: true, deactivatedAt: true, coverageStartsOn: true, coverageEndsOn: true } } } });
    if (!unit) return res.status(404).json({ error: "Unit not found." });
    res.json({ unit });
  } catch { res.status(500).json({ error: "Could not load unit history." }); }
});

app.post("/api/demo/:sessionId/brand/units/:unitId/lifecycle", async (req, res) => {
  const sessionId = checkSessionId(req, res); if (!sessionId) return;
  if (!isUuid(req.params.unitId)) return res.status(400).json({ error: "Invalid unit." });
  const type = req.body?.type;
  if (!["RETURN", "FOR_SALE_AGAIN", "ASSOCIATE_ORDER", "DELIVER"].includes(type)) return res.status(400).json({ error: "Choose a valid unit action." });
  try {
    const brand = await requireBrand(sessionId);
    const unit = await changeUnitLifecycle(brand.id, req.params.unitId, res.locals.account.id, "brand", { type, orderNumber: req.body?.orderNumber, deliveredOn: req.body?.deliveredOn });
    res.json({ unit });
  } catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : "Could not update the unit." }); }
});

// Brand Single Product Detail
app.get("/api/demo/:sessionId/brand/products/:productId", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  const { productId } = req.params;
  try {
    const brand = await requireBrand(sessionId);
    const product = await db.productModel.findFirst({
      where: { id: productId, brandId: brand.id },
      include: { _count: { select: { units: true } } },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ product: { ...product, unitCount: product._count.units }, brand });
  } catch (error: any) {
    console.error("Brand product detail error:", error);
    res.status(500).json({ error: error.message || "Failed to load product detail" });
  }
});

app.patch("/api/demo/:sessionId/brand/products/:productId/image", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  if (!isUuid(req.params.productId)) return res.status(400).json({ error: "Invalid product ID." });
  let uploadedImage: string | null = null;
  try {
    const brand = await requireBrand(sessionId);
    const product = await db.productModel.findFirst({ where: { id: req.params.productId, brandId: brand.id } });
    if (!product) return res.status(404).json({ error: "Product not found in this workspace." });
    const image = imageFromDataUrl(req.body?.imageDataUrl, "product image");
    if (!image) return res.status(400).json({ error: "Choose a product image." });
    uploadedImage = await saveProductImage(sessionId, product.id, image);
    const updated = await db.productModel.update({ where: { id: product.id }, data: { imageUrl: uploadedImage } });
    if (product.imageUrl) await removeNewProductImage(product.imageUrl);
    res.json({ imageUrl: updated.imageUrl });
  } catch (error) {
    if (uploadedImage) await removeNewProductImage(uploadedImage);
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not change the product image." });
  }
});

app.post("/api/demo/:sessionId/brand/products/:productId/units", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  if (!isUuid(req.params.productId)) return res.status(400).json({ error: "Invalid product." });
  const serialNumber = String(req.body.serialNumber || "").trim().toUpperCase();
  const orderNumber = String(req.body.orderNumber || "").trim();
  const deliveredOn = String(req.body.deliveredOn || "");
  const date = new Date(`${deliveredOn}T00:00:00.000Z`);
  if (!serialNumber || serialNumber.length > 120 || !orderNumber || orderNumber.length > 120 || !/^\d{4}-\d{2}-\d{2}$/.test(deliveredOn) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== deliveredOn || dateOnly(date) > dateOnly(new Date())) {
    return res.status(400).json({ error: "Enter the actual serial number, order reference and a valid delivery date that is not in the future." });
  }
  try {
    const brand = await requireBrand(sessionId);
    const product = await db.productModel.findFirst({ where: { id: req.params.productId, brandId: brand.id } });
    if (!product) return res.status(404).json({ error: "Product not found." });
    const unit = await db.$transaction(async tx => {
      const order = await tx.purchaseOrder.upsert({ where: { brandId_orderNumber: { brandId: brand.id, orderNumber } }, create: { brandId: brand.id, orderNumber, deliveredOn: date }, update: {} });
      if (order.deliveredOn && order.deliveredOn.getTime() !== date.getTime()) throw new Error("This order has a different delivery date. Check the original purchase record.");
      if (!order.deliveredOn) await tx.purchaseOrder.update({ where: { id: order.id }, data: { deliveredOn: date } });
      const existing = await tx.productUnit.findUnique({ where: { brandId_serialNumber: { brandId: brand.id, serialNumber } } });
      if (existing) {
        if (existing.productModelId !== product.id || (existing.purchaseOrderId && existing.purchaseOrderId !== order.id)) throw new Error("This Unit ID is already assigned to another product or order.");
        if (existing.purchaseOrderId) return existing;
        await tx.unitSale.create({ data: { unitId: existing.id, purchaseOrderId: order.id, confirmedDeliveredOn: date } });
        await tx.unitLifecycleEvent.create({ data: { unitId: existing.id, eventType: "ORDER_ASSOCIATED", accountId: res.locals.account.id, source: "brand", orderNumber } });
        return tx.productUnit.update({ where: { id: existing.id }, data: { purchaseOrderId: order.id, status: "DELIVERED" } });
      }
      const created = await tx.productUnit.create({ data: { brandId: brand.id, productModelId: product.id, purchaseOrderId: order.id, serialNumber, status: "DELIVERED" } });
      await tx.unitSale.create({ data: { unitId: created.id, purchaseOrderId: order.id, confirmedDeliveredOn: date } });
      await tx.unitLifecycleEvent.createMany({ data: [{ unitId: created.id, eventType: "CREATED", accountId: res.locals.account.id, source: "brand" }, { unitId: created.id, eventType: "ORDER_ASSOCIATED", accountId: res.locals.account.id, source: "brand", orderNumber }, { unitId: created.id, eventType: "DELIVERED", accountId: res.locals.account.id, source: "brand", orderNumber, detail: deliveredOn }] });
      return created;
    });
    res.status(201).json({ unit });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return res.status(409).json({ error: "This serial number is already recorded for your brand." });
    res.status(400).json({ error: error instanceof Error && error.message.startsWith("This order") ? error.message : "Could not save the unit. Please try again." });
  }
});

app.patch("/api/demo/:sessionId/brand/products/:productId/verification", async (req, res) => {
  const sessionId = checkSessionId(req, res); if (!sessionId) return;
  if (!isUuid(req.params.productId)) return res.status(400).json({ error: "Invalid product." });
  const verificationMode = req.body?.verificationMode;
  if (!Object.values(RegistrationVerificationMode).includes(verificationMode)) return res.status(400).json({ error: "Choose a valid verification method." });
  try {
    const brand = await requireBrand(sessionId);
    const result = await db.productModel.updateMany({ where: { id: req.params.productId, brandId: brand.id }, data: { verificationMode } });
    if (!result.count) return res.status(404).json({ error: "Product not found." });
    res.json({ verificationMode });
  } catch { res.status(500).json({ error: "Could not save verification settings." }); }
});

app.patch("/api/demo/:sessionId/brand/products/:productId/units/:unitId/order", async (req, res) => {
  const sessionId = checkSessionId(req, res); if (!sessionId) return;
  if (!isUuid(req.params.productId) || !isUuid(req.params.unitId)) return res.status(400).json({ error: "Invalid unit." });
  const orderNumber = String(req.body?.orderNumber ?? "").trim();
  if (!orderNumber || orderNumber.length > 120) return res.status(400).json({ error: "Enter an existing Order ID." });
  try {
    const brand = await requireBrand(sessionId);
    const unit = await db.productUnit.findFirst({ where: { id: req.params.unitId, brandId: brand.id, productModelId: req.params.productId }, include: { registration: true } });
    if (!unit) return res.status(404).json({ error: "Unit not found." });
    if (unit.registration || unit.purchaseOrderId) return res.status(409).json({ error: "This unit already has an order or warranty." });
    const order = await db.purchaseOrder.findUnique({ where: { brandId_orderNumber: { brandId: brand.id, orderNumber } } });
    if (!order) return res.status(400).json({ error: "Order ID must already exist in this brand." });
    await db.$transaction(async tx => {
      const changed = await tx.productUnit.updateMany({ where: { id: unit.id, brandId: brand.id, purchaseOrderId: null }, data: { purchaseOrderId: order.id, status: order.deliveredOn ? "DELIVERED" : "PENDING" } });
      if (!changed.count) throw new Error("Unit order changed. Refresh and try again.");
      await tx.unitSale.create({ data: { unitId: unit.id, purchaseOrderId: order.id, confirmedDeliveredOn: order.deliveredOn } });
      await tx.unitLifecycleEvent.create({ data: { unitId: unit.id, eventType: "ORDER_ASSOCIATED", accountId: res.locals.account.id, source: "brand", orderNumber } });
      if (order.deliveredOn) await tx.unitLifecycleEvent.create({ data: { unitId: unit.id, eventType: "DELIVERED", accountId: res.locals.account.id, source: "brand", orderNumber, detail: order.deliveredOn.toISOString().slice(0, 10) } });
    });
    res.json({ success: true });
  } catch { res.status(500).json({ error: "Could not link this order." }); }
});

// Brand Product Issue Tags
app.patch("/api/demo/:sessionId/brand/products/:productId/claim-photos", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  if (!isUuid(req.params.productId)) return res.status(400).json({ error: "Invalid product ID." });
  const claimPhotoLimit = req.body?.claimPhotoLimit;
  if (!Number.isInteger(claimPhotoLimit) || claimPhotoLimit < 0 || claimPhotoLimit > MAX_CLAIM_PHOTOS) return res.status(400).json({ error: "Choose a photo limit from 0 to 3." });
  try {
    const updated = await db.productModel.updateMany({ where: { id: req.params.productId, brand: { demoSessionId: sessionId } }, data: { claimPhotoLimit } });
    if (!updated.count) return res.status(404).json({ error: "Product not found in this workspace." });
    res.json({ claimPhotoLimit });
  } catch {
    res.status(500).json({ error: "Could not save claim photo settings." });
  }
});

// Brand Product Issue Tags
app.patch("/api/demo/:sessionId/brand/products/:productId/issue-tags", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  if (!isUuid(req.params.productId)) return res.status(400).json({ error: "Invalid product ID." });
  try {
    const issueTags = normalizeIssueTags(req.body?.issueTags);
    const updated = await db.productModel.updateMany({
      where: { id: req.params.productId, brand: { demoSessionId: sessionId } },
      data: { issueTags },
    });
    if (!updated.count) return res.status(404).json({ error: "Product not found in this workspace." });
    res.json({ issueTags });
  } catch (error) {
    res.status(error instanceof IssueTagValidationError ? 400 : 500).json({ error: error instanceof IssueTagValidationError ? error.message : "Could not save issue tags." });
  }
});

// Brand Create Product
app.post("/api/demo/:sessionId/brand/products", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  try {
    const brand = await requireBrand(sessionId);
    const { name, sku, warrantyMonths, serialNumber, orderNumber, deliveredOn } = req.body;
    const verificationMode = req.body.verificationMode ?? RegistrationVerificationMode.UNIT_ONLY;
    if (!Object.values(RegistrationVerificationMode).includes(verificationMode)) return res.status(400).json({ error: "Choose a valid verification method." });
    const issueTags = normalizeIssueTags(req.body.issueTags === undefined ? [] : req.body.issueTags);
    const claimPhotoLimit = req.body.claimPhotoLimit === undefined ? 3 : req.body.claimPhotoLimit;
    if (!Number.isInteger(claimPhotoLimit) || claimPhotoLimit < 0 || claimPhotoLimit > MAX_CLAIM_PHOTOS) return res.status(400).json({ error: "Choose a photo limit from 0 to 3." });

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "Product name is required." });
    }

    const duration = Number(warrantyMonths);
    if (!Number.isInteger(duration) || duration < 1 || duration > 120) {
      return res.status(400).json({ error: "Enter the actual warranty duration, from 1 to 120 months." });
    }
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const productId = randomUUID();
    let uploadedImage: string | null = null;
    try {
      const image = imageFromDataUrl(req.body?.imageDataUrl, "product image");
      if (image) uploadedImage = await saveProductImage(sessionId, productId, image);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || "The product image could not be saved." });
    }
    let newProduct;
    try { newProduct = await db.$transaction(async (tx) => {
      const createdModel = await tx.productModel.create({
        data: {
          id: productId,
          brandId: brand.id,
          name: name.trim(),
          slug: `${slug}-${randomUUID().slice(0, 4)}`,
          sku: sku ? String(sku).trim() : null,
          warrantyMonths: duration,
          claimPhotoLimit,
          imageUrl: uploadedImage,
          issueTags,
          verificationMode,
        },
      });

      if (serialNumber && orderNumber) {
        const cleanSerial = String(serialNumber).trim().toUpperCase();
        const cleanOrder = String(orderNumber).trim();
        if (!cleanSerial || cleanSerial.length > 120 || !cleanOrder || cleanOrder.length > 120) throw new Error("Enter valid Unit and Order IDs.");
        let order = await tx.purchaseOrder.findUnique({
          where: { brandId_orderNumber: { brandId: brand.id, orderNumber: cleanOrder } },
        });

        const deliveryDate = deliveredOn ? new Date(`${deliveredOn}T00:00:00.000Z`) : null;
        if (deliveryDate && (!/^\d{4}-\d{2}-\d{2}$/.test(deliveredOn) || !Number.isFinite(deliveryDate.getTime()) || deliveryDate.toISOString().slice(0, 10) !== deliveredOn || deliveryDate.getTime() > Date.now())) throw new Error("Enter a confirmed delivery date that is not in the future.");

        if (!order) {
          order = await tx.purchaseOrder.create({
            data: {
              brandId: brand.id,
              orderNumber: cleanOrder,
              deliveredOn: deliveryDate,
            },
          });
        }

        const unit = await tx.productUnit.create({
          data: {
            brandId: brand.id,
            productModelId: createdModel.id,
            purchaseOrderId: order.id,
            serialNumber: cleanSerial,
            status: deliveryDate ? "DELIVERED" : "PENDING",
          },
        });
        await tx.unitSale.create({ data: { unitId: unit.id, purchaseOrderId: order.id, confirmedDeliveredOn: deliveryDate } });
        await tx.unitLifecycleEvent.createMany({ data: [{ unitId: unit.id, eventType: "CREATED", accountId: res.locals.account.id, source: "brand" }, { unitId: unit.id, eventType: "ORDER_ASSOCIATED", accountId: res.locals.account.id, source: "brand", orderNumber: cleanOrder }, ...(deliveryDate ? [{ unitId: unit.id, eventType: "DELIVERED", accountId: res.locals.account.id, source: "brand", orderNumber: cleanOrder, detail: deliveredOn }] : [])] });
      }

      return createdModel;
    }); } catch (error) {
      if (uploadedImage) await removeNewProductImage(uploadedImage);
      throw error;
    }

    res.json({ success: true, product: newProduct });
  } catch (error: any) {
    console.error("Create product error:", error);
    res.status(400).json({ error: error.message || "Failed to create product" });
  }
});

// Brand Customers List
app.get("/api/demo/:sessionId/brand/customers", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  try {
    const brand = await requireBrand(sessionId);
    const customers = await db.customer.findMany({
      where: { demoSessionId: sessionId },
      include: {
        registrations: {
          where: { unit: { brandId: brand.id } },
          include: {
            unit: { include: { productModel: true, purchaseOrder: true } },
            claim: true,
          },
        },
        orders: { where: { brandId: brand.id } },
      },
      orderBy: { name: "asc" },
    });

    res.json({ brand, customers });
  } catch (error: any) {
    console.error("Brand customers error:", error);
    res.status(500).json({ error: error.message || "Failed to load customers" });
  }
});

// Brand Registrations List
app.get("/api/demo/:sessionId/brand/registrations", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  try {
    const brand = await requireBrand(sessionId);
    const pageSize = 10;
    const requestedPage = Number(req.query.page);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
    const product = typeof req.query.product === "string" ? req.query.product : "";
    if (product && !isUuid(product)) return res.status(400).json({ error: "Invalid product." });
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 120) : "";
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const today = dateOnly(new Date());
    const statusWhere: Prisma.WarrantyRegistrationWhereInput = status === "active"
      ? { active: true, coverageEndsOn: { gte: today } }
      : status === "expiring"
        ? { active: true, AND: [registrationAttentionWhere("expiring", today)] }
        : status === "expired"
          ? { active: true, coverageEndsOn: { lt: today } }
          : status === "ended"
            ? { active: false }
          : {};
    const searchWhere: Prisma.WarrantyRegistrationWhereInput = search ? { OR: [
      { unit: { serialNumber: { contains: search, mode: "insensitive" } } },
      { sale: { purchaseOrder: { orderNumber: { contains: search, mode: "insensitive" } } } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { customer: { email: { contains: search, mode: "insensitive" } } },
    ] } : {};
    const where: Prisma.WarrantyRegistrationWhereInput = { AND: [
      { unit: { brandId: brand.id, brand: { demoSessionId: sessionId } }, customer: { demoSessionId: sessionId } },
      product ? { unit: { productModelId: product } } : {},
      registrationAttentionWhere(req.query.filter, today), statusWhere, searchWhere,
    ] };
    const [total, products] = await Promise.all([
      db.warrantyRegistration.count({ where }),
      db.productModel.findMany({ where: { brandId: brand.id }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    const actualPage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
    const registrations = await db.warrantyRegistration.findMany({ where, select: {
        id: true, active: true, registeredAt: true, coverageStartsOn: true, coverageEndsOn: true,
        customer: { select: { name: true, email: true } },
        unit: { select: { serialNumber: true, productModel: { select: { id: true, name: true, imageUrl: true } }, purchaseOrder: { select: { orderNumber: true } } } },
        sale: { select: { purchaseOrder: { select: { orderNumber: true } } } },
        claim: { select: { id: true, reference: true, status: true } },
      }, orderBy: [{ registeredAt: "desc" }, { id: "desc" }], skip: (actualPage - 1) * pageSize, take: pageSize });
    res.json({ brand, registrations: registrations.map(({ sale, ...registration }) => ({ ...registration, unit: { ...registration.unit, purchaseOrder: sale?.purchaseOrder ?? null } })), products, total, page: actualPage, pageSize });
  } catch (error: any) {
    console.error("Brand registrations error:", error);
    res.status(500).json({ error: error.message || "Failed to load registrations" });
  }
});

// Analytics uses saved registration, claim and resolution-event records.
app.get("/api/demo/:sessionId/brand/analytics", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  try {
    const brand = await requireBrand(sessionId);
    const periodDays = req.query.days === "90" ? 90 : 30;
    res.json({ brand, ...await loadAnalytics(brand.id, sessionId, periodDays) });
  } catch {
    res.status(500).json({ error: "Could not load analytics. Please try again." });
  }
});

// Brand Settings
app.get("/api/demo/:sessionId/brand/settings", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  try {
    const brand = await requireBrand(sessionId);
    res.json({ brand });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load settings" });
  }
});

app.post("/api/demo/:sessionId/brand/settings", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  try {
    const brand = await requireBrand(sessionId);
    const { name, supportEmail } = req.body;
    let uploadedLogo: string | null = null;
    const logo = imageFromDataUrl(req.body?.logoDataUrl, "brand logo");
    if (logo) uploadedLogo = await saveBrandLogo(sessionId, brand.id, logo);
    const updated = await db.brand.update({
      where: { id: brand.id },
      data: {
        ...(name ? { name: String(name).trim() } : {}),
        ...(supportEmail ? { supportEmail: String(supportEmail).trim() } : {}),
        ...(uploadedLogo ? { logoUrl: uploadedLogo } : req.body?.removeLogo ? { logoUrl: null } : {}),
      },
    });
    if (brand.logoUrl && brand.logoUrl !== updated.logoUrl) await removeNewProductImage(brand.logoUrl);
    res.json({ success: true, brand: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to update settings" });
  }
});

// -------------------------------------------------------------
// CUSTOMER PORTAL APIS
// -------------------------------------------------------------

// Only the linked product and customer details are needed to open a registration link.
// The dashboard endpoint below also loads registrations, claims and notifications.
app.get("/api/demo/:sessionId/register/:brandSlug/:productSlug", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  try {
    const product = await db.productModel.findFirst({
        where: { slug: req.params.productSlug, brand: { slug: req.params.brandSlug, demoSessionId: sessionId } },
        select: {
          id: true, name: true, slug: true, imageUrl: true, warrantyMonths: true, verificationMode: true,
          brand: { select: { name: true, slug: true, logoUrl: true } },
        },
      });
    if (!product) return res.status(404).json({ error: "This registration link does not match an active product." });
    const { brand, ...registrationProduct } = product;
    res.json({ brand, product: registrationProduct });
  } catch (error: any) {
    console.error("Registration product error:", error);
    res.status(500).json({ error: "Could not load this product." });
  }
});

// Customer Dashboard
app.get("/api/demo/:sessionId/customer", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  try {
    const [customer, workspaceBrand] = await Promise.all([
      db.customer.findFirst({ where: { demoSessionId: sessionId, accountId: res.locals.account.id } }),
      db.brand.findFirst({ where: { demoSessionId: sessionId }, include: { products: { select: { id: true, name: true, slug: true, imageUrl: true, warrantyMonths: true }, orderBy: { name: "asc" } } } }),
    ]);
    if (!customer) {
      return res.json({ customer: null, brand: workspaceBrand, availableProducts: workspaceBrand?.products || [], warranties: [], notifications: [] });
    }

    const registrations = await db.warrantyRegistration.findMany({
      where: { customerId: customer.id, unit: { brand: { demoSessionId: sessionId } } },
      include: {
        unit: { include: { productModel: true, brand: true } },
        sale: { include: { purchaseOrder: true } },
        claim: { include: { addressRequest: { select: { receivedAt: true } }, resolution: { select: { type: true, status: true, step: true } } } },
      },
      orderBy: { registeredAt: "desc" },
    });

    const notificationRegistrations = await db.warrantyRegistration.findMany({ where: { customerId: customer.id, unit: { brand: { demoSessionId: sessionId } } }, select: { id: true, claim: { select: { id: true } } } });
    const notificationIds = notificationRegistrations.flatMap(item => [item.id, ...(item.claim ? [item.claim.id] : [])]);
    const notifications = await db.demoNotification.findMany({
      where: { demoSessionId: sessionId, recipientLabel: "Customer", relatedId: { in: notificationIds } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const brand = workspaceBrand;

    const formattedWarranties = registrations.map((r) => {
      const active = r.active && isCoverageActive(r.coverageEndsOn);
      const remainingDays = active ? daysRemaining(r.coverageEndsOn) : 0;
      const totalMonths = r.unit.productModel.warrantyMonths;
      const totalDays = totalMonths * 30.5;
      const progressPercent = Math.max(0, Math.min(100, Math.round((remainingDays / totalDays) * 100)));

      return {
        registrationId: r.id,
        unitId: r.unitId,
        productModelId: r.unit.productModelId,
        serialNumber: r.unit.serialNumber,
        productName: r.unit.productModel.name,
        imageUrl: r.unit.productModel.imageUrl,
        brandName: r.unit.brand.name,
        warrantyMonths: r.unit.productModel.warrantyMonths,
        coverageStartsOn: r.coverageStartsOn,
        coverageEndsOn: r.coverageEndsOn,
        isActive: active,
        registrationActive: r.active,
        daysRemaining: remainingDays,
        progressPercent,
        orderNumber: r.sale?.purchaseOrder.orderNumber ?? null,
        deliveredOn: r.coverageStartsOn,
        claim: r.claim
          ? {
              id: r.claim.id,
              reference: r.claim.reference,
              status: r.claim.status,
              issueTitle: r.claim.issueTitle,
              submittedAt: r.claim.submittedAt,
              addressNeeded: !!r.claim.addressRequest && !r.claim.addressRequest.receivedAt,
              resolution: r.claim.resolution,
            }
          : null,
      };
    });

    res.json({
      customer,
      brand,
      warranties: formattedWarranties,
      availableProducts: workspaceBrand?.products || [],
      notifications,
    });
  } catch (error: any) {
    console.error("Customer dashboard error:", error);
    res.status(500).json({ error: error.message || "Failed to load customer dashboard" });
  }
});

// Customer Unit Detail
app.get("/api/demo/:sessionId/customer/products/:unitId", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  const { unitId } = req.params;
  try {
    const registration = await db.warrantyRegistration.findFirst({
      where: { unitId, active: true, customer: { demoSessionId: sessionId, accountId: res.locals.account.id } },
      include: {
        unit: { include: { productModel: true, brand: true } },
        sale: { include: { purchaseOrder: true } },
        claim: true,
        customer: true,
      },
    });

    if (!registration) {
      return res.status(404).json({ error: "Registered unit not found" });
    }

    res.json({ registration: { ...registration, unit: { ...registration.unit, purchaseOrder: registration.sale?.purchaseOrder ?? null } } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load unit details" });
  }
});

// Customer Single Claim Detail
app.get("/api/demo/:sessionId/customer/claims/:claimId", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  const { claimId } = req.params;
  try {
    const claim = await db.warrantyClaim.findFirst({
      where: {
        id: claimId,
        registration: { customer: { demoSessionId: sessionId, accountId: res.locals.account.id } },
      },
      include: {
        registration: {
          include: {
            sale: { include: { purchaseOrder: true } },
            unit: { include: { productModel: true, brand: true, purchaseOrder: true } },
            customer: true,
          },
        },
        events: { orderBy: { createdAt: "asc" } },
        messages: { orderBy: { createdAt: "asc" } },
        attachments: { select: { id: true, createdAt: true }, orderBy: { createdAt: "asc" } },
        addressRequest: true,
        resolution: { select: { type: true, status: true, step: true, startedAt: true, completedAt: true, updatedAt: true, trackingNumber: true, courier: true, refundAmount: true, refundCurrency: true, replacementUnit: { select: { serialNumber: true } }, events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, action: true, toStep: true, toStatus: true, occurredOn: true, customerMessage: true, createdAt: true } } } },
      },
    });

    if (!claim) {
      return res.status(404).json({ error: "Claim not found" });
    }

    res.json({ claim: { ...claim, registration: { ...claim.registration, unit: { ...claim.registration.unit, purchaseOrder: claim.registration.sale?.purchaseOrder ?? null } } } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load claim detail" });
  }
});

// Customer Submit Claim
app.post("/api/demo/:sessionId/customer/claims", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  const { unitId, issueTitle, description, submissionId: clientSubmissionId } = req.body;
  const rawPhotos = req.body?.photoDataUrls ?? [];

  if (!isUuid(String(unitId || "")) || typeof issueTitle !== "string" || typeof description !== "string" || !issueTitle.trim() || !description.trim() || issueTitle.trim().length > 120 || description.trim().length > 3000) {
    return res.status(400).json({ error: "Choose a registered product and describe the issue. Use up to 120 characters for the summary and 3,000 for the description." });
  }
  if (!Array.isArray(rawPhotos) || rawPhotos.length > MAX_CLAIM_PHOTOS) return res.status(400).json({ error: "Attach no more than three photos." });
  let photos: File[];
  try {
    photos = rawPhotos.map(value => {
      const photo = imageFromDataUrl(value, "claim photo");
      if (!photo) throw new Error("Choose a valid claim photo.");
      return photo;
    });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Choose valid claim photos." });
  }

  const submissionId = clientSubmissionId && isUuid(clientSubmissionId) ? clientSubmissionId : randomUUID();
  let uploadedKeys: string[] = [];

  try {
    const registration = await db.warrantyRegistration.findFirst({
      where: { unitId, active: true, customer: { demoSessionId: sessionId, accountId: res.locals.account.id }, unit: { brand: { demoSessionId: sessionId } } },
      include: { claim: { select: { id: true } }, unit: { include: { productModel: true, brand: true, purchaseOrder: true } }, customer: true },
    });

    if (!registration) {
      return res.status(404).json({ error: "Warranty registration not found." });
    }
    if (photos.length > registration.unit.productModel.claimPhotoLimit) {
      return res.status(400).json({ error: registration.unit.productModel.claimPhotoLimit === 0 ? "This product does not accept claim photos." : `Attach no more than ${registration.unit.productModel.claimPhotoLimit} photos for this product.` });
    }
    if (registration.claim) {
      return res.json({ success: true, claimId: registration.claim.id, alreadyExists: true });
    }
    if (!isCoverageActive(registration.coverageEndsOn) || dateOnly(registration.coverageStartsOn) > dateOnly(new Date())) {
      return res.status(400).json({ error: "Warranty coverage has expired." });
    }

    const reference = `VCH-${submissionId.replaceAll("-", "").toUpperCase()}`;
    const issueTags = selectProductIssueTags(req.body.issueTags === undefined ? [] : req.body.issueTags, registration.unit.productModel.issueTags);
    const uploads = await Promise.allSettled(photos.map(photo => saveClaimImage(sessionId, submissionId, photo)));
    uploadedKeys = uploads.filter((upload): upload is PromiseFulfilledResult<string> => upload.status === "fulfilled").map(upload => upload.value);
    const failedUpload = uploads.find((upload): upload is PromiseRejectedResult => upload.status === "rejected");
    if (failedUpload) throw failedUpload.reason;

    const claim = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ProductUnit" WHERE id = ${unitId}::uuid FOR UPDATE`;
      const eligible = await tx.warrantyRegistration.findFirst({ where: { id: registration.id, active: true, unit: { activeRegistrationId: registration.id } }, select: { id: true } });
      if (!eligible) throw new Error("Warranty registration has ended.");
      const created = await tx.warrantyClaim.create({
        data: {
          id: submissionId,
          registrationId: registration.id,
          reference,
          issueTitle: String(issueTitle).trim(),
          description: String(description).trim(),
          issueTags,
          status: ClaimStatus.SUBMITTED,
        },
      });

      await tx.claimEvent.create({
        data: {
          claimId: created.id,
          actor: ActorRole.CUSTOMER,
          toStatus: ClaimStatus.SUBMITTED,
          note: "Claim submitted by customer.",
        },
      });
      await tx.unitLifecycleEvent.create({ data: { unitId, eventType: "CLAIM_SUBMITTED", source: "customer", detail: reference } });

      if (uploadedKeys.length) await tx.claimAttachment.createMany({ data: uploadedKeys.map(fileKey => ({ claimId: created.id, fileKey })) });

      await tx.demoNotification.createMany({
        data: [
          {
            demoSessionId: sessionId,
            type: NotificationType.CLAIM_SUBMITTED_CUSTOMER,
            recipientLabel: "Customer",
            subject: "We received your warranty claim",
            previewBody: `${reference} was submitted for ${registration.unit.productModel.name}. Preview — not sent.`,
            relatedId: created.id,
          },
          {
            demoSessionId: sessionId,
            type: NotificationType.CLAIM_SUBMITTED_BRAND,
            recipientLabel: registration.unit.brand.name,
            subject: "New warranty claim",
            previewBody: `${reference} was submitted. Review in workspace. Preview — not sent.`,
            relatedId: created.id,
          },
        ],
      });

      return created;
    });

    res.json({ success: true, claimId: claim.id, reference: claim.reference });
  } catch (error: any) {
    await removeClaimImages(uploadedKeys);
    if (error instanceof ClaimImageStorageError) {
      console.error("Private claim photo storage unavailable:", error.message);
      return res.status(503).json({ error: "Photo upload is temporarily unavailable. Please try again later." });
    }
    // Concurrent submissions hit the database's unique registration constraint.
    if (error instanceof IssueTagValidationError) return res.status(400).json({ error: error.message });
    // Return the existing claim rather than leaking an error or creating another.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.warrantyClaim.findFirst({ where: { registration: { unitId, customer: { demoSessionId: sessionId, accountId: res.locals.account.id }, unit: { brand: { demoSessionId: sessionId } } } }, select: { id: true } });
      if (existing) return res.json({ success: true, claimId: existing.id, alreadyExists: true });
    }
    res.status(400).json({ error: "Your claim could not be submitted. Please try again." });
  }
});

// Customer Reply to Information Request
app.post("/api/demo/:sessionId/customer/claims/:claimId/address", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  if (!isUuid(req.params.claimId)) return res.status(400).json({ error: "Invalid claim." });
  const limits = { recipient: 120, line1: 200, line2: 200, city: 100, region: 100, postalCode: 30, country: 100, phone: 30 } as const;
  const address: Record<keyof typeof limits, string> = {} as Record<keyof typeof limits, string>;
  for (const [field, maximum] of Object.entries(limits) as [keyof typeof limits, number][]) {
    const value = req.body?.[field];
    if (typeof value !== "string" && value !== undefined) return res.status(400).json({ error: "Enter a valid address." });
    const clean = (value || "").trim();
    if (clean.length > maximum || (!clean && !["line2", "phone"].includes(field))) return res.status(400).json({ error: "Complete the address fields and keep each entry within its limit." });
    address[field] = clean;
  }
  try {
    const claim = await db.warrantyClaim.findFirst({
      where: { id: req.params.claimId, registration: { customer: { demoSessionId: sessionId, accountId: res.locals.account.id } } },
      include: { addressRequest: true },
    });
    if (!claim) return res.status(404).json({ error: "Claim not found." });
    if (claim.status !== ClaimStatus.APPROVED || !claim.addressRequest) return res.status(409).json({ error: "This claim is not waiting for an address." });
    await db.$transaction(async tx => {
      await tx.claimAddress.update({ where: { claimId: claim.id }, data: { ...address, receivedAt: new Date() } });
      await tx.claimEvent.create({ data: { claimId: claim.id, actor: ActorRole.CUSTOMER, fromStatus: ClaimStatus.APPROVED, toStatus: ClaimStatus.APPROVED, note: claim.addressRequest?.receivedAt ? "Customer updated their address." : "Customer provided their address." } });
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Could not save the address. Please try again." });
  }
});

// Customer Reply to Information Request
app.post("/api/demo/:sessionId/customer/claims/:claimId/reply", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  const { claimId } = req.params;
  const { message } = req.body;

  const reply = String(message || "").trim();
  if (!reply) {
    return res.status(400).json({ error: "Please enter your response." });
  }

  try {
    const scope = { id: claimId, registration: { customer: { demoSessionId: sessionId, accountId: res.locals.account.id } } };
    await db.$transaction(async (tx) => {
      const claim = await tx.warrantyClaim.findFirst({ where: scope });
      if (!claim) throw new Error("Claim not found.");
      if (claim.status !== ClaimStatus.INFO_REQUESTED) {
        throw new Error("This claim is not waiting for additional information.");
      }

      await tx.warrantyClaim.update({
        where: { id: claimId },
        data: { status: ClaimStatus.UNDER_REVIEW },
      });

      await tx.claimMessage.create({
        data: {
          claimId,
          author: ActorRole.CUSTOMER,
          body: reply,
        },
      });

      await tx.claimEvent.create({
        data: {
          claimId,
          actor: ActorRole.CUSTOMER,
          fromStatus: ClaimStatus.INFO_REQUESTED,
          toStatus: ClaimStatus.UNDER_REVIEW,
          note: `Customer responded: "${reply.slice(0, 100)}${reply.length > 100 ? "..." : ""}"`,
        },
      });
    });

    res.json({ success: true, message: "Response submitted" });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Failed to reply to claim" });
  }
});

// Register Stamped Unit ID
app.post("/api/demo/:sessionId/register", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  const { brandSlug, productSlug, serialNumber, orderNumber } = req.body;

  const cleanSerial = String(serialNumber || "").trim().toUpperCase();
  const cleanOrder = String(orderNumber || "").trim();
  const cleanEmail = res.locals.account.email as string;
  const cleanName = res.locals.account.displayName as string;

  if (!cleanName || !cleanEmail) {
    return res.status(400).json({ error: "Missing required registration fields." });
  }

  try {
    const product = await db.productModel.findFirst({ where: { slug: productSlug, brand: { slug: brandSlug, demoSessionId: sessionId } }, include: { brand: true } });
    if (!product) return res.status(404).json({ error: "Product not found." });
    const dual = product.verificationMode === RegistrationVerificationMode.ORDER_AND_UNIT;
    const orderOnly = product.verificationMode === RegistrationVerificationMode.ORDER_ONLY;
    if (((dual || orderOnly) && !cleanOrder) || ((dual || !orderOnly) && !cleanSerial)) return res.status(400).json({ error: "Enter the required Order ID and Unit ID for this product." });
    if (cleanSerial.length > 120 || cleanOrder.length > 120 || /[\u0000-\u001f\u007f]/.test(cleanSerial + cleanOrder)) return res.status(400).json({ error: "Check the Order ID and Unit ID format." });
    const customer = await db.customer.findFirst({ where: { demoSessionId: sessionId, accountId: res.locals.account.id } });
    if (orderOnly && customer) {
      const prior = await db.warrantyRegistration.findFirst({ where: { customerId: customer.id, active: true, unit: { brandId: product.brandId, productModelId: product.id, purchaseOrder: { orderNumber: cleanOrder } } }, select: { unitId: true } });
      if (prior) return res.json({ success: true, unitId: prior.unitId, alreadyRegistered: true });
    }
    const unit = await db.productUnit.findFirst({
      where: { brandId: product.brandId, productModelId: product.id, ...(orderOnly ? { purchaseOrder: { orderNumber: cleanOrder, brandId: product.brandId }, registration: null } : { serialNumber: cleanSerial }), ...(dual ? { purchaseOrder: { orderNumber: cleanOrder, brandId: product.brandId } } : {}) },
      include: { productModel: true, purchaseOrder: true, registration: true, sales: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "asc" },
    });

    if (!unit) {
      return res.status(404).json({ error: dual ? "These registration details could not be verified." : orderOnly ? "No eligible unit was found for this Order ID." : "Unit not found with that serial number. Check stamped ID." });
    }

    if (!unit.purchaseOrder || unit.purchaseOrder.brandId !== product.brandId || (unit.purchaseOrder.customerId && unit.purchaseOrder.customerId !== customer?.id)) return res.status(404).json({ error: "These registration details could not be verified." });
    if (unit.sales.length > 1 && (!cleanSerial || !cleanOrder || cleanSerial !== unit.serialNumber || cleanOrder !== unit.purchaseOrder.orderNumber)) return res.status(404).json({ error: "Resold units require the current Unit ID and new Order ID." });

    if (unit.registration) {
      if (unit.registration.customerId !== customer?.id) return res.status(409).json({ error: dual ? "These registration details could not be verified." : "This serial number is registered to another customer." });
      return res.json({ success: true, unitId: unit.id, alreadyRegistered: true });
    }

    if (unit.status !== "DELIVERED") return res.status(400).json({ error: "This unit order has not been confirmed delivered yet." });

    const deliveredOn = unit.sales.find(sale => sale.isCurrent)?.confirmedDeliveredOn;
    if (!deliveredOn || dateOnly(deliveredOn).getTime() > dateOnly(new Date()).getTime()) {
      return res.status(400).json({ error: "This unit order has not been delivered yet." });
    }

    const start = dateOnly(deliveredOn);
    const end = addCalendarMonths(start, unit.productModel.warrantyMonths);

    const reg = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ProductUnit" WHERE id = ${unit.id}::uuid FOR UPDATE`;
      const current = await tx.productUnit.findUniqueOrThrow({ where: { id: unit.id }, select: { status: true, activeRegistrationId: true, purchaseOrderId: true } });
      if (current.status !== "DELIVERED" || current.activeRegistrationId || current.purchaseOrderId !== unit.purchaseOrderId) throw new Error("Unit eligibility changed. Refresh and try again.");
      const registeredCustomer = customer ?? await tx.customer.create({ data: { demoSessionId: sessionId, accountId: res.locals.account.id, name: cleanName, email: cleanEmail } });
      if (customer) await tx.customer.update({ where: { id: customer.id }, data: { name: cleanName, email: cleanEmail } });
      const created = await tx.warrantyRegistration.create({
        data: {
          unitId: unit.id,
          saleId: unit.sales.find(sale => sale.isCurrent)?.id,
          customerId: registeredCustomer.id,
          coverageStartsOn: start,
          coverageEndsOn: end,
        },
      });
      await tx.productUnit.update({ where: { id: unit.id }, data: { activeRegistrationId: created.id } });
      await tx.unitLifecycleEvent.create({ data: { unitId: unit.id, eventType: "REGISTERED", source: "customer", orderNumber: unit.purchaseOrder?.orderNumber } });

      await tx.demoNotification.create({
        data: {
          demoSessionId: sessionId,
          type: NotificationType.WARRANTY_REGISTERED,
          recipientLabel: "Customer",
          subject: "Your warranty is registered",
          previewBody: `${unit.productModel.name} (${cleanSerial}) covered through ${end.toISOString().slice(0, 10)}. Preview — not sent.`,
          relatedId: created.id,
        },
      });

      const email = registrationEmail(unit.productModel.name, product.brand.name, end);
      await tx.emailOutbox.create({ data: {
        eventKey: `warranty-registered/${created.id}`,
        recipient: cleanEmail,
        sender: process.env.EMAIL_FROM || "Vouch <onboarding@resend.dev>",
        ...email,
      } });
      return created;
    });

    res.json({ success: true, unitId: unit.id, registration: reg });
  } catch (error: any) {
    console.error("Register warranty error:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return res.status(409).json({ error: "This unit has already been registered." });
    res.status(400).json({ error: "Could not register this warranty. Check the product details and try again." });
  }
});

// Serve product images uploaded locally
app.get("/demo/:sessionId/product-images/:productId/:filename", async (req, res) => {
  const { sessionId, productId, filename } = req.params;
  try {
    const fileBytes = await readProductImage(sessionId, productId, filename);
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
    };
    res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.send(fileBytes);
  } catch {
    res.status(404).send("Not found");
  }
});

app.get("/demo/:sessionId/brand-images/:brandId/:filename", async (req, res) => {
  const { sessionId, brandId, filename } = req.params;
  const logoUrl = `/demo/${sessionId}/brand-images/${brandId}/${filename}`;
  try {
    const brand = await db.brand.findFirst({ where: { id: brandId, demoSessionId: sessionId, logoUrl }, select: { id: true } });
    if (!brand) return res.status(404).send("Not found");
    const fileBytes = await readProductImage(sessionId, brandId, filename);
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
    res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.send(fileBytes);
  } catch {
    res.status(404).send("Not found");
  }
});

// API failures must stay JSON, including malformed/oversized request bodies.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found. Restart the app with npm run dev." });
});
const apiErrorHandler: express.ErrorRequestHandler = (error, _req, res, _next) => {
  const status = error.type === "entity.too.large" ? 413 : error.type === "entity.parse.failed" ? 400 : 500;
  res.status(status).json({ error: status === 413 ? "Upload too large. Each image must be 5 MB or smaller." : status === 400 ? "Invalid JSON request body." : "The server could not complete this request." });
};
app.use(apiErrorHandler);

app.listen(PORT, () => {
  console.log(`[Vouch API Server] running on http://localhost:${PORT}`);
  startEmailWorker();
});
