CREATE TYPE "LateRegistrationAction" AS ENUM ('REJECT', 'MANUAL_REVIEW');
CREATE TYPE "RegistrationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "RegistrationPolicy" (
  "brandId" UUID NOT NULL,
  "registrationWindowDays" INTEGER,
  "lateRegistrationAction" "LateRegistrationAction" NOT NULL DEFAULT 'REJECT',
  CONSTRAINT "RegistrationPolicy_pkey" PRIMARY KEY ("brandId"),
  CONSTRAINT "RegistrationPolicy_registrationWindowDays_check" CHECK ("registrationWindowDays" IS NULL OR "registrationWindowDays" BETWEEN 1 AND 3650)
);
ALTER TABLE "RegistrationPolicy" ADD CONSTRAINT "RegistrationPolicy_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RegistrationRequest" (
  "id" UUID NOT NULL,
  "brandId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "productModelId" UUID NOT NULL,
  "unitId" UUID NOT NULL,
  "saleId" UUID NOT NULL,
  "deliveredOn" DATE NOT NULL,
  "deadlineOn" DATE NOT NULL,
  "windowDays" INTEGER NOT NULL,
  "status" "RegistrationRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewerAccountId" UUID,
  "rejectionReason" TEXT,
  CONSTRAINT "RegistrationRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RegistrationRequest_windowDays_check" CHECK ("windowDays" BETWEEN 1 AND 3650)
);
CREATE UNIQUE INDEX "RegistrationRequest_saleId_key" ON "RegistrationRequest"("saleId");
CREATE INDEX "RegistrationRequest_brandId_status_requestedAt_idx" ON "RegistrationRequest"("brandId", "status", "requestedAt");
CREATE INDEX "RegistrationRequest_customerId_requestedAt_idx" ON "RegistrationRequest"("customerId", "requestedAt");
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_productModelId_fkey" FOREIGN KEY ("productModelId") REFERENCES "ProductModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "ProductUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "UnitSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_reviewerAccountId_fkey" FOREIGN KEY ("reviewerAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
