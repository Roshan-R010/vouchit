CREATE TYPE "RegistrationVerificationMode" AS ENUM ('UNIT_ONLY', 'ORDER_ONLY', 'ORDER_AND_UNIT');
ALTER TABLE "ProductModel" ADD COLUMN "verificationMode" "RegistrationVerificationMode" NOT NULL DEFAULT 'UNIT_ONLY';
ALTER TABLE "ProductUnit" ALTER COLUMN "purchaseOrderId" DROP NOT NULL;
ALTER TABLE "ProductUnit" DROP CONSTRAINT IF EXISTS "ProductUnit_purchaseOrderId_fkey";
ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ProductUnit_brandId_productModelId_idx" ON "ProductUnit"("brandId", "productModelId");
CREATE INDEX "ProductUnit_brandId_purchaseOrderId_idx" ON "ProductUnit"("brandId", "purchaseOrderId");
CREATE TABLE "UnitImport" (
  "id" UUID NOT NULL,
  "brandId" UUID NOT NULL,
  "accountId" UUID,
  "filename" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "totalRows" INTEGER NOT NULL,
  "insertedRows" INTEGER NOT NULL DEFAULT 0,
  "skippedRows" INTEGER NOT NULL DEFAULT 0,
  "failedRows" INTEGER NOT NULL DEFAULT 0,
  "summary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UnitImport_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "UnitImport" ADD CONSTRAINT "UnitImport_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "UnitImport_brandId_createdAt_idx" ON "UnitImport"("brandId", "createdAt");
