ALTER TYPE "NotificationType" ADD VALUE 'WARRANTY_ENDED';
CREATE TYPE "UnitStatus" AS ENUM ('PENDING', 'DELIVERED', 'RETURNED', 'FOR_SALE_AGAIN');

ALTER TABLE "ProductUnit" ADD COLUMN "status" "UnitStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "ProductUnit" ADD COLUMN "activeRegistrationId" UUID;
UPDATE "ProductUnit" u SET "status" = 'DELIVERED'
FROM "PurchaseOrder" o WHERE u."purchaseOrderId" = o.id AND o."deliveredOn" IS NOT NULL;

CREATE TABLE "UnitSale" (
  "id" UUID NOT NULL PRIMARY KEY,
  "unitId" UUID NOT NULL,
  "purchaseOrderId" UUID NOT NULL,
  "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  "expectedDeliveryOn" DATE,
  "confirmedDeliveredOn" DATE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "UnitSale_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "ProductUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UnitSale_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UnitSale_one_current_per_unit" ON "UnitSale"("unitId") WHERE "isCurrent" = true;
CREATE INDEX "UnitSale_unitId_createdAt_idx" ON "UnitSale"("unitId", "createdAt");
CREATE INDEX "UnitSale_purchaseOrderId_idx" ON "UnitSale"("purchaseOrderId");
INSERT INTO "UnitSale" ("id", "unitId", "purchaseOrderId", "confirmedDeliveredOn", "createdAt")
SELECT gen_random_uuid(), u.id, u."purchaseOrderId", o."deliveredOn", u."createdAt"
FROM "ProductUnit" u JOIN "PurchaseOrder" o ON o.id = u."purchaseOrderId";

ALTER TABLE "WarrantyRegistration" DROP CONSTRAINT IF EXISTS "WarrantyRegistration_unitId_key";
DROP INDEX IF EXISTS "WarrantyRegistration_unitId_key";
ALTER TABLE "WarrantyRegistration" ADD COLUMN "saleId" UUID;
ALTER TABLE "WarrantyRegistration" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "WarrantyRegistration" ADD COLUMN "deactivatedAt" TIMESTAMP(3);
ALTER TABLE "WarrantyRegistration" ADD COLUMN "deactivationReason" TEXT;
UPDATE "WarrantyRegistration" r SET "saleId" = s.id FROM "UnitSale" s WHERE s."unitId" = r."unitId" AND s."isCurrent" = true;
UPDATE "ProductUnit" u SET "activeRegistrationId" = r.id FROM "WarrantyRegistration" r WHERE r."unitId" = u.id;
CREATE UNIQUE INDEX "WarrantyRegistration_one_active_per_unit" ON "WarrantyRegistration"("unitId") WHERE "active" = true;
CREATE INDEX "WarrantyRegistration_unitId_registeredAt_idx" ON "WarrantyRegistration"("unitId", "registeredAt");
CREATE UNIQUE INDEX "ProductUnit_activeRegistrationId_key" ON "ProductUnit"("activeRegistrationId");
ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_activeRegistrationId_fkey" FOREIGN KEY ("activeRegistrationId") REFERENCES "WarrantyRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WarrantyRegistration" ADD CONSTRAINT "WarrantyRegistration_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "UnitSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "UnitLifecycleEvent" (
  "id" UUID NOT NULL PRIMARY KEY,
  "unitId" UUID NOT NULL,
  "eventType" TEXT NOT NULL,
  "accountId" UUID,
  "source" TEXT NOT NULL,
  "orderNumber" TEXT,
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UnitLifecycleEvent_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "ProductUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "UnitLifecycleEvent_unitId_createdAt_idx" ON "UnitLifecycleEvent"("unitId", "createdAt");
INSERT INTO "UnitLifecycleEvent" ("id", "unitId", "eventType", "source", "createdAt")
SELECT gen_random_uuid(), id, 'CREATED', 'migration', "createdAt" FROM "ProductUnit";
INSERT INTO "UnitLifecycleEvent" ("id", "unitId", "eventType", "source", "orderNumber", "createdAt")
SELECT gen_random_uuid(), s."unitId", 'ORDER_ASSOCIATED', 'migration', o."orderNumber", s."createdAt"
FROM "UnitSale" s JOIN "PurchaseOrder" o ON o.id = s."purchaseOrderId";
INSERT INTO "UnitLifecycleEvent" ("id", "unitId", "eventType", "source", "orderNumber", "detail", "createdAt")
SELECT gen_random_uuid(), s."unitId", 'DELIVERED', 'migration', o."orderNumber", s."confirmedDeliveredOn"::text, s."confirmedDeliveredOn"::timestamp
FROM "UnitSale" s JOIN "PurchaseOrder" o ON o.id = s."purchaseOrderId" WHERE s."confirmedDeliveredOn" IS NOT NULL;
INSERT INTO "UnitLifecycleEvent" ("id", "unitId", "eventType", "source", "createdAt")
SELECT gen_random_uuid(), "unitId", 'REGISTERED', 'migration', "registeredAt" FROM "WarrantyRegistration";
INSERT INTO "UnitLifecycleEvent" ("id", "unitId", "eventType", "source", "detail", "createdAt")
SELECT gen_random_uuid(), r."unitId", 'CLAIM_SUBMITTED', 'migration', c.reference, c."submittedAt"
FROM "WarrantyClaim" c JOIN "WarrantyRegistration" r ON r.id = c."registrationId";

CREATE TABLE "ImportProfile" (
  "id" UUID NOT NULL PRIMARY KEY,
  "brandId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "importType" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "ImportProfile_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ImportProfile_brandId_name_key" ON "ImportProfile"("brandId", "name");
ALTER TABLE "UnitImport" ADD COLUMN "importType" TEXT;
ALTER TABLE "UnitImport" ADD COLUMN "profileName" TEXT;
ALTER TABLE "UnitImport" ADD COLUMN "updatedRows" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UnitImport" ADD COLUMN "returnedRows" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WarrantyClaim" ADD COLUMN "requiresReturnReview" BOOLEAN NOT NULL DEFAULT false;
