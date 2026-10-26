import { loadAnalytics } from "./analytics";
import { IssueTagValidationError, normalizeIssueTags, selectProductIssueTags } from "../src/lib/issue-tags";
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { File } from "node:buffer";
import { AccountRole, ActorRole, ClaimStatus, NotificationType, Prisma, ResolutionMethod } from "@prisma/client";
import { currentAccount, endSession, hashPassword, startSession, verifyPassword } from "./auth";
import { db } from "../src/lib/db";
import { requireBrand, isUuid } from "../src/lib/brand";
import { createDemoSession, resetDemoSession, sessionCustomer } from "../src/lib/demo";
import { addCalendarMonths, dateOnly, daysRemaining, formatDate, isCoverageActive } from "../src/lib/dates";
import { readProductImage, removeNewProductImage, saveBrandLogo, saveProductImage } from "../src/lib/product-images";

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
app.use(express.json({ limit: "8mb" }));
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

app.get("/api/account/customer", async (req, res) => {
  const account = await currentAccount(req);
  if (!account || account.role !== AccountRole.CUSTOMER) return res.status(401).json({ error: "Please sign in as a customer." });
  try {
    const registrations = await db.warrantyRegistration.findMany({
      where: { customer: { accountId: account.id } },
      include: { unit: { include: { productModel: true, purchaseOrder: true, brand: true } }, claim: true },
      orderBy: { registeredAt: "desc" },
    });
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
          orderNumber: r.unit.purchaseOrder.orderNumber, deliveredOn: r.unit.purchaseOrder.deliveredOn,
          claim: r.claim ? { id: r.claim.id, reference: r.claim.reference, status: r.claim.status, issueTitle: r.claim.issueTitle, submittedAt: r.claim.submittedAt } : null,
        };
      }),
      notifications: [],
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
app.get("/api/demo/:sessionId/brand", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  try {
    const brand = await requireBrand(sessionId);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [allRegistrations, allClaims, products, recentClaims, recentRegistrations] = await Promise.all([
      db.warrantyRegistration.findMany({
        where: { unit: { brandId: brand.id }, customer: { demoSessionId: sessionId } },
        select: { registeredAt: true },
      }),
      db.warrantyClaim.findMany({
        where: { registration: { unit: { brandId: brand.id }, customer: { demoSessionId: sessionId } } },
        select: { status: true, issueTitle: true, reference: true, id: true, submittedAt: true },
      }),
      db.productModel.findMany({ where: { brandId: brand.id }, select: { id: true, name: true } }),
      db.warrantyClaim.findMany({
        where: { registration: { unit: { brandId: brand.id }, customer: { demoSessionId: sessionId } } },
        include: { registration: { include: { customer: true, unit: { include: { productModel: true } } } } },
        orderBy: { submittedAt: "desc" },
        take: 5,
      }),
      db.warrantyRegistration.findMany({
        where: { unit: { brandId: brand.id }, customer: { demoSessionId: sessionId }, registeredAt: { gte: thirtyDaysAgo } },
        select: { registeredAt: true },
        orderBy: { registeredAt: "asc" },
      }),
    ]);

    const openStatuses = ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED"];
    const openClaims = allClaims.filter((c) => openStatuses.includes(c.status));
    const needsReview = allClaims.filter((c) => c.status === "SUBMITTED").length;

    // Build chart data for last 30 days
    const days: { label: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const ds = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const count = recentRegistrations.filter((r) => r.registeredAt.toISOString().slice(0, 10) === ds).length;
      days.push({ label, count });
    }

    res.json({
      brand,
      metrics: {
        totalRegistrations: allRegistrations.length,
        openClaimsCount: openClaims.length,
        needsReviewCount: needsReview,
        productsCount: products.length,
      },
      chartData: days,
      recentClaims: recentClaims.map((claim) => ({
        id: claim.id,
        reference: claim.reference,
        issueTitle: claim.issueTitle,
        status: claim.status,
        submittedAt: claim.submittedAt,
        customerName: claim.registration.customer.name,
        productName: claim.registration.unit.productModel.name,
      })),
    });
  } catch (error: any) {
    console.error("Brand dashboard error:", error);
    res.status(500).json({ error: error.message || "Failed to load brand dashboard" });
  }
});

// Brand Claims List
app.get("/api/demo/:sessionId/brand/claims", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  try {
    const brand = await requireBrand(sessionId);
    const { status, product, search } = req.query;

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

    if (status && typeof status === "string") {
      if (status === "open") {
        where.status = { in: [ClaimStatus.SUBMITTED, ClaimStatus.UNDER_REVIEW, ClaimStatus.INFO_REQUESTED] };
      } else if (status === "needs_review") {
        where.status = ClaimStatus.SUBMITTED;
      } else if (status === "in_review") {
        where.status = ClaimStatus.UNDER_REVIEW;
      } else if (status === "resolved") {
        where.status = { in: [ClaimStatus.APPROVED, ClaimStatus.RESOLVED] };
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
              unit: { include: { productModel: true, purchaseOrder: true } },
            },
          },
        },
        orderBy: { submittedAt: "desc" },
      }),
      db.productModel.findMany({
        where: { brandId: brand.id },
        select: { id: true, name: true },
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
      in_review: allCounts.filter((c) => c.status === ClaimStatus.UNDER_REVIEW).length,
      open: allCounts.filter((c) => ([ClaimStatus.SUBMITTED, ClaimStatus.UNDER_REVIEW, ClaimStatus.INFO_REQUESTED] as ClaimStatus[]).includes(c.status)).length,
      resolved: allCounts.filter((c) => ([ClaimStatus.APPROVED, ClaimStatus.RESOLVED] as ClaimStatus[]).includes(c.status)).length,
      rejected: allCounts.filter((c) => c.status === ClaimStatus.REJECTED).length,
    };

    res.json({
      claims: claims.map((c) => ({
        id: c.id,
        reference: c.reference,
        status: c.status,
        issueTitle: c.issueTitle,
        description: c.description,
        submittedAt: c.submittedAt,
        resolutionMethod: c.resolutionMethod,
        customer: {
          name: c.registration.customer.name,
          email: c.registration.customer.email,
        },
        unit: {
          serialNumber: c.registration.unit.serialNumber,
          productModel: c.registration.unit.productModel.name,
          orderNumber: c.registration.unit.purchaseOrder.orderNumber,
          deliveredOn: c.registration.unit.purchaseOrder.deliveredOn,
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
            unit: { include: { productModel: true, purchaseOrder: true } },
          },
        },
        events: { orderBy: { createdAt: "asc" } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!claim) {
      return res.status(404).json({ error: "Claim not found" });
    }

    res.json({ claim });
  } catch (error: any) {
    console.error("Brand claim detail error:", error);
    res.status(500).json({ error: error.message || "Failed to load claim detail" });
  }
});

// Brand Claim Status Action
app.post("/api/demo/:sessionId/brand/claims/:claimId/action", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  const { claimId } = req.params;
  const { decision, note, resolutionMethod } = req.body;

  const transitions: Record<string, { from: ClaimStatus; to: ClaimStatus; note: string }> = {
    review: { from: ClaimStatus.SUBMITTED, to: ClaimStatus.UNDER_REVIEW, note: "The brand started reviewing this claim." },
    approve: { from: ClaimStatus.UNDER_REVIEW, to: ClaimStatus.APPROVED, note: "The brand approved this claim." },
    reject: { from: ClaimStatus.UNDER_REVIEW, to: ClaimStatus.REJECTED, note: "The brand rejected this claim." },
    request_info: { from: ClaimStatus.UNDER_REVIEW, to: ClaimStatus.INFO_REQUESTED, note: "The brand requested more information." },
    resolve: { from: ClaimStatus.APPROVED, to: ClaimStatus.RESOLVED, note: "The brand resolved this claim." },
  };

  const transition = transitions[decision];
  if (!transition) {
    return res.status(400).json({ error: "Invalid claim decision action." });
  }

  const cleanNote = String(note || "").trim();
  if (cleanNote.length > 2000) {
    return res.status(400).json({ error: "Keep your message under 2,000 characters." });
  }
  if (["reject", "request_info", "resolve"].includes(decision) && !cleanNote) {
    return res.status(400).json({
      error:
        decision === "request_info"
          ? "Enter the question you want the customer to answer."
          : decision === "resolve"
          ? "Describe the repair or replacement outcome."
          : "Enter a reason for rejecting this claim.",
    });
  }
  if (decision === "resolve" && resolutionMethod !== ResolutionMethod.REPAIR && resolutionMethod !== ResolutionMethod.REPLACEMENT) {
    return res.status(400).json({ error: "Choose whether the product was repaired or replaced." });
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
        include: { registration: { include: { customer: true, unit: { include: { productModel: true } } } } },
      });
      if (!claim) throw new Error("This claim could not be found.");
      if (claim.status !== transition.from) throw new Error("This claim status has changed. Refresh to see latest status.");

      const changed = await tx.warrantyClaim.updateMany({
        where: { ...scope, status: transition.from },
        data: {
          status: transition.to,
          ...(decision === "resolve" ? { resolutionMethod: resolutionMethod as ResolutionMethod } : {}),
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

    const messages: Record<string, string> = { UNDER_REVIEW: "Review started.", APPROVED: "Claim approved. Record the resolution when the repair or replacement is complete.", REJECTED: "Claim rejected. The reason is recorded in the claim history.", INFO_REQUESTED: "Information requested. The customer can reply from their claim page.", RESOLVED: "Claim resolved. The outcome has been recorded." };
    res.json({ success: true, message: messages[transition.to] });
  } catch (error: any) {
    console.error("Brand claim action error:", error);
    res.status(400).json({ error: error.message || "Failed to update claim" });
  }
});

// Brand Products Catalog
app.get("/api/demo/:sessionId/brand/products", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  try {
    const brand = await requireBrand(sessionId);
    const products = await db.productModel.findMany({
      where: { brandId: brand.id },
      include: {
        units: {
          include: {
            purchaseOrder: true,
            registration: {
              include: {
                claim: true,
                customer: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    res.json({ brand, products });
  } catch (error: any) {
    console.error("Brand products error:", error);
    res.status(500).json({ error: error.message || "Failed to load products" });
  }
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
      include: {
        units: {
          include: {
            purchaseOrder: true,
            registration: {
              include: { customer: true, claim: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ product, brand });
  } catch (error: any) {
    console.error("Brand product detail error:", error);
    res.status(500).json({ error: error.message || "Failed to load product detail" });
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
      if (order.deliveredOn?.getTime() !== date.getTime()) throw new Error("This order has a different delivery date. Check the original purchase record.");
      return tx.productUnit.create({ data: { brandId: brand.id, productModelId: product.id, purchaseOrderId: order.id, serialNumber } });
    });
    res.status(201).json({ unit });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return res.status(409).json({ error: "This serial number is already recorded for your brand." });
    res.status(400).json({ error: error instanceof Error && error.message.startsWith("This order") ? error.message : "Could not save the unit. Please try again." });
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
    const issueTags = normalizeIssueTags(req.body.issueTags === undefined ? [] : req.body.issueTags);

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
          imageUrl: uploadedImage,
          issueTags,
        },
      });

      if (serialNumber && orderNumber) {
        let order = await tx.purchaseOrder.findUnique({
          where: { brandId_orderNumber: { brandId: brand.id, orderNumber: String(orderNumber).trim() } },
        });

        const deliveryDate = deliveredOn ? new Date(`${deliveredOn}T00:00:00.000Z`) : null;

        if (!order) {
          order = await tx.purchaseOrder.create({
            data: {
              brandId: brand.id,
              orderNumber: String(orderNumber).trim(),
              deliveredOn: deliveryDate,
            },
          });
        }

        await tx.productUnit.create({
          data: {
            brandId: brand.id,
            productModelId: createdModel.id,
            purchaseOrderId: order.id,
            serialNumber: String(serialNumber).trim().toUpperCase(),
          },
        });
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
    const registrations = await db.warrantyRegistration.findMany({
      where: {
        unit: { brandId: brand.id, brand: { demoSessionId: sessionId } },
        customer: { demoSessionId: sessionId },
      },
      include: {
        customer: true,
        unit: {
          include: {
            productModel: true,
            purchaseOrder: true,
          },
        },
        claim: true,
      },
      orderBy: { registeredAt: "desc" },
    });

    res.json({ brand, registrations });
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
          id: true, name: true, slug: true, imageUrl: true, warrantyMonths: true,
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
        unit: { include: { productModel: true, purchaseOrder: true, brand: true } },
        claim: true,
      },
      orderBy: { registeredAt: "desc" },
    });

    const notifications = await db.demoNotification.findMany({
      where: { demoSessionId: sessionId, recipientLabel: "Customer", relatedId: { in: registrations.map(r => r.id) } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const brand = workspaceBrand;

    const formattedWarranties = registrations.map((r) => {
      const active = isCoverageActive(r.coverageEndsOn);
      const remainingDays = daysRemaining(r.coverageEndsOn);
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
        daysRemaining: remainingDays,
        progressPercent,
        orderNumber: r.unit.purchaseOrder.orderNumber,
        deliveredOn: r.unit.purchaseOrder.deliveredOn,
        claim: r.claim
          ? {
              id: r.claim.id,
              reference: r.claim.reference,
              status: r.claim.status,
              issueTitle: r.claim.issueTitle,
              submittedAt: r.claim.submittedAt,
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
      where: { unitId, customer: { demoSessionId: sessionId, accountId: res.locals.account.id } },
      include: {
        unit: { include: { productModel: true, purchaseOrder: true, brand: true } },
        claim: true,
        customer: true,
      },
    });

    if (!registration) {
      return res.status(404).json({ error: "Registered unit not found" });
    }

    res.json({ registration });
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
            unit: { include: { productModel: true, brand: true, purchaseOrder: true } },
            customer: true,
          },
        },
        events: { orderBy: { createdAt: "asc" } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!claim) {
      return res.status(404).json({ error: "Claim not found" });
    }

    res.json({ claim });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load claim detail" });
  }
});

// Customer Submit Claim
app.post("/api/demo/:sessionId/customer/claims", async (req, res) => {
  const sessionId = checkSessionId(req, res);
  if (!sessionId) return;
  const { unitId, issueTitle, description, submissionId: clientSubmissionId } = req.body;

  if (!isUuid(String(unitId || "")) || typeof issueTitle !== "string" || typeof description !== "string" || !issueTitle.trim() || !description.trim() || issueTitle.trim().length > 120 || description.trim().length > 3000) {
    return res.status(400).json({ error: "Choose a registered product and describe the issue. Use up to 120 characters for the summary and 3,000 for the description." });
  }

  const submissionId = clientSubmissionId && isUuid(clientSubmissionId) ? clientSubmissionId : randomUUID();

  try {
    const registration = await db.warrantyRegistration.findFirst({
      where: { unitId, customer: { demoSessionId: sessionId, accountId: res.locals.account.id }, unit: { brand: { demoSessionId: sessionId } } },
      include: { claim: { select: { id: true } }, unit: { include: { productModel: true, brand: true, purchaseOrder: true } }, customer: true },
    });

    if (!registration) {
      return res.status(404).json({ error: "Warranty registration not found." });
    }
    if (registration.claim) {
      return res.json({ success: true, claimId: registration.claim.id, alreadyExists: true });
    }
    if (!isCoverageActive(registration.coverageEndsOn) || dateOnly(registration.coverageStartsOn) > dateOnly(new Date())) {
      return res.status(400).json({ error: "Warranty coverage has expired." });
    }

    const reference = `VCH-${submissionId.replaceAll("-", "").toUpperCase()}`;
    const issueTags = selectProductIssueTags(req.body.issueTags === undefined ? [] : req.body.issueTags, registration.unit.productModel.issueTags);

    const claim = await db.$transaction(async (tx) => {
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
  const { brandSlug, productSlug, serialNumber } = req.body;

  const cleanSerial = String(serialNumber || "").trim().toUpperCase();
  const cleanEmail = res.locals.account.email as string;
  const cleanName = res.locals.account.displayName as string;

  if (!cleanSerial || !cleanName || !cleanEmail) {
    return res.status(400).json({ error: "Missing required registration fields." });
  }

  try {
    const customer = await db.customer.findFirst({ where: { demoSessionId: sessionId, accountId: res.locals.account.id } });
    const unit = await db.productUnit.findFirst({
      where: {
        serialNumber: cleanSerial,
        brand: { slug: brandSlug, demoSessionId: sessionId },
        productModel: { slug: productSlug },
      },
      include: { productModel: true, purchaseOrder: true, registration: true },
    });

    if (!unit) {
      return res.status(404).json({ error: "Unit not found with that serial number. Check stamped ID." });
    }

    if (unit.registration) {
      if (unit.registration.customerId !== customer?.id) return res.status(409).json({ error: "This serial number is registered to another customer." });
      return res.json({ success: true, unitId: unit.id, alreadyRegistered: true });
    }

    const deliveredOn = unit.purchaseOrder.deliveredOn;
    if (!deliveredOn || dateOnly(deliveredOn).getTime() > dateOnly(new Date()).getTime()) {
      return res.status(400).json({ error: "This unit order has not been delivered yet." });
    }

    const start = dateOnly(deliveredOn);
    const end = addCalendarMonths(start, unit.productModel.warrantyMonths);

    const reg = await db.$transaction(async (tx) => {
      const registeredCustomer = customer ?? await tx.customer.create({ data: { demoSessionId: sessionId, accountId: res.locals.account.id, name: cleanName, email: cleanEmail } });
      if (customer) await tx.customer.update({ where: { id: customer.id }, data: { name: cleanName, email: cleanEmail } });
      const created = await tx.warrantyRegistration.create({
        data: {
          unitId: unit.id,
          customerId: registeredCustomer.id,
          coverageStartsOn: start,
          coverageEndsOn: end,
        },
      });

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

      return created;
    });

    res.json({ success: true, unitId: unit.id, registration: reg });
  } catch (error: any) {
    console.error("Register warranty error:", error);
    res.status(400).json({ error: error.message || "Failed to register warranty" });
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
});
