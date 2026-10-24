-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED', 'REJECTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ActorRole" AS ENUM ('CUSTOMER', 'BRAND', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ResolutionMethod" AS ENUM ('REPAIR', 'REPLACEMENT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('WARRANTY_REGISTERED', 'CLAIM_SUBMITTED_CUSTOMER', 'CLAIM_SUBMITTED_BRAND');

-- CreateTable
CREATE TABLE "DemoSession" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "DemoSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" UUID NOT NULL,
    "demoSessionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "supportEmail" TEXT,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductModel" (
    "id" UUID NOT NULL,
    "brandId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sku" TEXT,
    "imageUrl" TEXT,
    "warrantyMonths" INTEGER NOT NULL DEFAULT 36,

    CONSTRAINT "ProductModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "demoSessionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" UUID NOT NULL,
    "brandId" UUID NOT NULL,
    "customerId" UUID,
    "orderNumber" TEXT NOT NULL,
    "orderedOn" DATE,
    "deliveredOn" DATE,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductUnit" (
    "id" UUID NOT NULL,
    "brandId" UUID NOT NULL,
    "productModelId" UUID NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyRegistration" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "coverageStartsOn" DATE NOT NULL,
    "coverageEndsOn" DATE NOT NULL,

    CONSTRAINT "WarrantyRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyClaim" (
    "id" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "issueTitle" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolutionMethod" "ResolutionMethod",

    CONSTRAINT "WarrantyClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimAttachment" (
    "id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "fileKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimMessage" (
    "id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "author" "ActorRole" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimEvent" (
    "id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "actor" "ActorRole" NOT NULL,
    "fromStatus" "ClaimStatus",
    "toStatus" "ClaimStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoNotification" (
    "id" UUID NOT NULL,
    "demoSessionId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "recipientLabel" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "previewBody" TEXT NOT NULL,
    "relatedId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_demoSessionId_slug_key" ON "Brand"("demoSessionId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductModel_brandId_slug_key" ON "ProductModel"("brandId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_demoSessionId_email_key" ON "Customer"("demoSessionId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_brandId_orderNumber_key" ON "PurchaseOrder"("brandId", "orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProductUnit_brandId_serialNumber_key" ON "ProductUnit"("brandId", "serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WarrantyRegistration_unitId_key" ON "WarrantyRegistration"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "WarrantyClaim_reference_key" ON "WarrantyClaim"("reference");

-- CreateIndex
CREATE INDEX "WarrantyClaim_status_idx" ON "WarrantyClaim"("status");

-- CreateIndex
CREATE INDEX "WarrantyClaim_submittedAt_idx" ON "WarrantyClaim"("submittedAt");

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_demoSessionId_fkey" FOREIGN KEY ("demoSessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModel" ADD CONSTRAINT "ProductModel_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_demoSessionId_fkey" FOREIGN KEY ("demoSessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_productModelId_fkey" FOREIGN KEY ("productModelId") REFERENCES "ProductModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyRegistration" ADD CONSTRAINT "WarrantyRegistration_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "ProductUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyRegistration" ADD CONSTRAINT "WarrantyRegistration_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "WarrantyRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimAttachment" ADD CONSTRAINT "ClaimAttachment_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "WarrantyClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimMessage" ADD CONSTRAINT "ClaimMessage_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "WarrantyClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvent" ADD CONSTRAINT "ClaimEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "WarrantyClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoNotification" ADD CONSTRAINT "DemoNotification_demoSessionId_fkey" FOREIGN KEY ("demoSessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
