CREATE TYPE "ClaimTemplateCategory" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_INFO');
CREATE TYPE "ClaimCostCategory" AS ENUM ('REPAIR_LABOR', 'REPLACEMENT_PRODUCT', 'PARTS_MATERIALS', 'RETURN_SHIPPING', 'OUTBOUND_SHIPPING', 'REFUND_PAID', 'OTHER');

CREATE TABLE "ClaimTemplate" (
  "id" UUID NOT NULL,
  "brandId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "category" "ClaimTemplateCategory" NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClaimTemplate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClaimTemplate_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 100),
  CONSTRAINT "ClaimTemplate_body_check" CHECK (length(btrim("body")) BETWEEN 1 AND 2000)
);
CREATE UNIQUE INDEX "ClaimTemplate_brandId_name_key" ON "ClaimTemplate"("brandId", "name");
CREATE INDEX "ClaimTemplate_brandId_category_idx" ON "ClaimTemplate"("brandId", "category");
ALTER TABLE "ClaimTemplate" ADD CONSTRAINT "ClaimTemplate_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ClaimCost" (
  "id" UUID NOT NULL,
  "claimId" UUID NOT NULL,
  "category" "ClaimCostCategory" NOT NULL,
  "amountPaise" INTEGER NOT NULL,
  "note" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClaimCost_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClaimCost_amountPaise_check" CHECK ("amountPaise" BETWEEN 0 AND 999999999),
  CONSTRAINT "ClaimCost_note_check" CHECK ("note" IS NULL OR length("note") <= 500),
  CONSTRAINT "ClaimCost_version_check" CHECK ("version" > 0)
);
CREATE INDEX "ClaimCost_claimId_createdAt_idx" ON "ClaimCost"("claimId", "createdAt");
ALTER TABLE "ClaimCost" ADD CONSTRAINT "ClaimCost_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "WarrantyClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
