import { ClaimCostCategory, ClaimTemplateCategory, Prisma } from "@prisma/client";
import { Router } from "express";
import { db } from "../src/lib/db";
import { isUuid, requireBrand } from "../src/lib/brand";

export const claimAdminRouter = Router({ mergeParams: true });
const sessionIdOf = (params: Record<string, string>) => params.sessionId;

const templateCategories = new Set(Object.values(ClaimTemplateCategory));
const costCategories = new Set(Object.values(ClaimCostCategory));

export function templateInput(value: any) {
  const name = typeof value?.name === "string" ? value.name.trim() : "";
  const body = typeof value?.body === "string" ? value.body.trim() : "";
  const category = value?.category;
  if (!name || name.length > 100) throw new Error("Enter a template name of up to 100 characters.");
  if (!body || body.length > 2000) throw new Error("Enter a message of up to 2,000 characters.");
  if (!templateCategories.has(category)) throw new Error("Choose a valid template category.");
  return { name, body, category: category as ClaimTemplateCategory };
}

export function costInput(value: any) {
  const category = value?.category;
  const note = typeof value?.note === "string" ? value.note.trim() : "";
  if (!costCategories.has(category)) throw new Error("Choose a valid cost category.");
  if (value?.currency !== undefined && value.currency !== "INR") throw new Error("Costs must be in INR.");
  if (note.length > 500 || (value?.note !== undefined && typeof value.note !== "string")) throw new Error("Keep the note under 500 characters.");
  return { category: category as ClaimCostCategory, amountPaise: parseCostAmount(value?.amount),
    ...(value?.label !== undefined ? { label: parseCostLabel(value.label) } : {}),
    ...(value?.note !== undefined ? { note: note || null } : {}),
  };
}

export function parseCostAmount(amount: unknown) {
  if (typeof amount !== "string" || !/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(amount)) throw new Error("Enter an INR amount from 0 to 9,999,999.99 with up to two decimals.");
  const [rupees, paise = ""] = amount.split(".");
  return Number(rupees) * 100 + Number(paise.padEnd(2, "0"));
}

function parseCostLabel(label: unknown) {
  const clean = typeof label === "string" ? label.trim() : "";
  if (!clean || clean.length > 120) throw new Error("Enter an expense name of up to 120 characters.");
  return clean;
}

function versionInput(value: any) {
  if (!Number.isInteger(value) || value < 1) throw new Error("Refresh this expense before changing it.");
  return value as number;
}

function apiError(res: any, error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return res.status(409).json({ error: "A template with that name already exists." });
  if (error instanceof Prisma.PrismaClientKnownRequestError) return res.status(500).json({ error: "Could not save changes." });
  return res.status(400).json({ error: error instanceof Error ? error.message : "Could not save changes." });
}

async function claimForBrand(sessionId: string, claimId: string) {
  if (!isUuid(claimId)) return null;
  const brand = await requireBrand(sessionId);
  return db.warrantyClaim.findFirst({
    where: { id: claimId, registration: { unit: { brandId: brand.id }, customer: { demoSessionId: sessionId } } },
    select: { id: true },
  });
}

async function costList(claimId: string) {
  const costs = await db.claimCost.findMany({ where: { claimId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const totalPaise = costs.reduce((sum, cost) => sum + BigInt(cost.amountPaise), 0n);
  return { costs, totalPaise: totalPaise.toString(), currency: "INR" };
}

claimAdminRouter.get("/claim-templates", async (req, res) => {
  try {
    const brand = await requireBrand(sessionIdOf(req.params));
    res.json({ templates: await db.claimTemplate.findMany({ where: { brandId: brand.id }, orderBy: [{ category: "asc" }, { name: "asc" }] }) });
  } catch (error) { apiError(res, error); }
});

claimAdminRouter.post("/claim-templates", async (req, res) => {
  try {
    const brand = await requireBrand(sessionIdOf(req.params));
    const template = await db.claimTemplate.create({ data: { brandId: brand.id, ...templateInput(req.body) } });
    res.status(201).json({ template });
  } catch (error) { apiError(res, error); }
});

claimAdminRouter.put("/claim-templates/:templateId", async (req, res) => {
  try {
    const brand = await requireBrand(sessionIdOf(req.params));
    if (!isUuid(req.params.templateId)) return res.status(404).json({ error: "Template not found." });
    const changed = await db.claimTemplate.updateMany({ where: { id: req.params.templateId, brandId: brand.id }, data: templateInput(req.body) });
    if (!changed.count) return res.status(404).json({ error: "Template not found." });
    res.json({ template: await db.claimTemplate.findFirst({ where: { id: req.params.templateId, brandId: brand.id } }) });
  } catch (error) { apiError(res, error); }
});

claimAdminRouter.delete("/claim-templates/:templateId", async (req, res) => {
  try {
    const brand = await requireBrand(sessionIdOf(req.params));
    if (!isUuid(req.params.templateId)) return res.status(404).json({ error: "Template not found." });
    const changed = await db.claimTemplate.deleteMany({ where: { id: req.params.templateId, brandId: brand.id } });
    if (!changed.count) return res.status(404).json({ error: "Template not found." });
    res.json({ success: true });
  } catch (error) { apiError(res, error); }
});

claimAdminRouter.get("/claims/:claimId/costs", async (req, res) => {
  try {
    const claim = await claimForBrand(sessionIdOf(req.params), req.params.claimId);
    if (!claim) return res.status(404).json({ error: "Claim not found." });
    res.json(await costList(claim.id));
  } catch (error) { apiError(res, error); }
});

claimAdminRouter.post("/claims/:claimId/costs", async (req, res) => {
  try {
    const claim = await claimForBrand(sessionIdOf(req.params), req.params.claimId);
    if (!claim) return res.status(404).json({ error: "Claim not found." });
    const cost = await db.claimCost.create({ data: { claimId: claim.id, ...costInput(req.body) } });
    res.status(201).json({ cost });
  } catch (error) { apiError(res, error); }
});

class CostBatchConflict extends Error {}

// One Save changes operation is atomic: a stale row rolls back every addition,
// edit and removal in this request. Legacy category and note fields stay intact.
claimAdminRouter.put("/claims/:claimId/costs/batch", async (req, res) => {
  try {
    const claim = await claimForBrand(sessionIdOf(req.params), req.params.claimId);
    if (!claim) return res.status(404).json({ error: "Claim not found." });
    const rawUpserts = req.body?.upserts;
    const rawDeletes = req.body?.deletes;
    if (!Array.isArray(rawUpserts) || !Array.isArray(rawDeletes) || rawUpserts.length + rawDeletes.length > 100) throw new Error("Save up to 100 expense changes at once.");
    const upserts = rawUpserts.map((row: any) => {
      if (row?.currency !== undefined && row.currency !== "INR") throw new Error("Costs must be in INR.");
      const label = parseCostLabel(row?.label);
      const amountPaise = parseCostAmount(row?.amount);
      if (row?.id !== undefined) {
        if (!isUuid(row.id) || row.newId !== undefined) throw new Error("Invalid expense ID.");
        return { id: row.id as string, version: versionInput(row.version), label, amountPaise };
      }
      if (!isUuid(row?.newId) || row?.version !== undefined) throw new Error("Invalid new expense ID.");
      return { newId: row.newId as string, label, amountPaise };
    });
    const deletes = rawDeletes.map((row: any) => {
      if (!isUuid(row?.id)) throw new Error("Invalid expense ID.");
      return { id: row.id as string, version: versionInput(row.version) };
    });
    const ids = [...upserts.map((row: any) => row.id ?? row.newId), ...deletes.map((row: any) => row.id)];
    if (new Set(ids).size !== ids.length) throw new Error("An expense appears more than once in this save.");
    await db.$transaction(async tx => {
      for (const row of deletes) {
        const changed = await tx.claimCost.deleteMany({ where: { id: row.id, claimId: claim.id, version: row.version } });
        if (changed.count !== 1) throw new CostBatchConflict("An expense was changed or removed elsewhere. No changes were saved.");
      }
      for (const row of upserts) {
        if ("id" in row) {
          const changed = await tx.claimCost.updateMany({ where: { id: row.id, claimId: claim.id, version: row.version }, data: { label: row.label, amountPaise: row.amountPaise, version: { increment: 1 } } });
          if (changed.count !== 1) throw new CostBatchConflict("An expense was changed or removed elsewhere. No changes were saved.");
        } else {
          await tx.claimCost.create({ data: { id: row.newId, claimId: claim.id, category: ClaimCostCategory.OTHER, label: row.label, amountPaise: row.amountPaise } });
        }
      }
    }, { maxWait: 10_000, timeout: 20_000 });
    res.json(await costList(claim.id));
  } catch (error) {
    if (error instanceof CostBatchConflict) return res.status(409).json({ error: error.message });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return res.status(409).json({ error: "This save was already applied. Refresh the costs before trying again." });
    apiError(res, error);
  }
});

claimAdminRouter.put("/claims/:claimId/costs/:costId", async (req, res) => {
  try {
    const claim = await claimForBrand(sessionIdOf(req.params), req.params.claimId);
    if (!claim || !isUuid(req.params.costId)) return res.status(404).json({ error: "Expense not found." });
    const version = versionInput(req.body?.version);
    const data = costInput(req.body);
    const changed = await db.claimCost.updateMany({ where: { id: req.params.costId, claimId: claim.id, version }, data: { ...data, version: { increment: 1 } } });
    if (!changed.count) {
      const exists = await db.claimCost.count({ where: { id: req.params.costId, claimId: claim.id } });
      return res.status(exists ? 409 : 404).json({ error: exists ? "This expense was changed elsewhere. Refresh and try again." : "Expense not found." });
    }
    res.json({ cost: await db.claimCost.findFirst({ where: { id: req.params.costId, claimId: claim.id } }) });
  } catch (error) { apiError(res, error); }
});

claimAdminRouter.delete("/claims/:claimId/costs/:costId", async (req, res) => {
  try {
    const claim = await claimForBrand(sessionIdOf(req.params), req.params.claimId);
    if (!claim || !isUuid(req.params.costId)) return res.status(404).json({ error: "Expense not found." });
    const version = versionInput(req.body?.version);
    const changed = await db.claimCost.deleteMany({ where: { id: req.params.costId, claimId: claim.id, version } });
    if (!changed.count) {
      const exists = await db.claimCost.count({ where: { id: req.params.costId, claimId: claim.id } });
      return res.status(exists ? 409 : 404).json({ error: exists ? "This expense was changed elsewhere. Refresh and try again." : "Expense not found." });
    }
    res.json({ success: true });
  } catch (error) { apiError(res, error); }
});
