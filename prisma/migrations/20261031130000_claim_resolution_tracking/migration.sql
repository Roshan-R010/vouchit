ALTER TYPE "NotificationType" ADD VALUE 'CLAIM_RESOLUTION_UPDATE';
CREATE TYPE "ResolutionType" AS ENUM ('REPAIR', 'REPLACEMENT', 'REFUND');
CREATE TYPE "ResolutionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "ClaimResolution" (
  "id" UUID NOT NULL PRIMARY KEY,
  "claimId" UUID NOT NULL,
  "type" "ResolutionType" NOT NULL,
  "status" "ResolutionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "step" TEXT NOT NULL,
  "serviceReference" TEXT,
  "trackingNumber" TEXT,
  "courier" TEXT,
  "refundAmount" DECIMAL(12,2),
  "refundCurrency" TEXT,
  "replacementUnitId" UUID,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" UUID,
  "updatedById" UUID,
  CONSTRAINT "ClaimResolution_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "WarrantyClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClaimResolution_replacementUnitId_fkey" FOREIGN KEY ("replacementUnitId") REFERENCES "ProductUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ClaimResolution_claimId_key" ON "ClaimResolution"("claimId");
CREATE UNIQUE INDEX "ClaimResolution_replacementUnitId_key" ON "ClaimResolution"("replacementUnitId");
CREATE INDEX "ClaimResolution_replacementUnitId_idx" ON "ClaimResolution"("replacementUnitId");

CREATE TABLE "ClaimResolutionEvent" (
  "id" UUID NOT NULL PRIMARY KEY,
  "resolutionId" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "fromType" "ResolutionType",
  "toType" "ResolutionType" NOT NULL,
  "fromStatus" "ResolutionStatus",
  "toStatus" "ResolutionStatus" NOT NULL,
  "fromStep" TEXT,
  "toStep" TEXT NOT NULL,
  "occurredOn" DATE,
  "referenceNumber" TEXT,
  "internalNote" TEXT,
  "customerMessage" TEXT,
  "actorAccountId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClaimResolutionEvent_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "ClaimResolution"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ClaimResolutionEvent_requestId_key" ON "ClaimResolutionEvent"("requestId");
CREATE INDEX "ClaimResolutionEvent_resolutionId_createdAt_idx" ON "ClaimResolutionEvent"("resolutionId", "createdAt");

ALTER TABLE "DemoNotification" ADD COLUMN "eventKey" TEXT;
CREATE UNIQUE INDEX "DemoNotification_eventKey_key" ON "DemoNotification"("eventKey");
