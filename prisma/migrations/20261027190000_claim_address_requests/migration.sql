CREATE TABLE "ClaimAddress" (
    "id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "recipient" TEXT,
    "line1" TEXT,
    "line2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "phone" TEXT,
    CONSTRAINT "ClaimAddress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClaimAddress_claimId_key" ON "ClaimAddress"("claimId");
ALTER TABLE "ClaimAddress" ADD CONSTRAINT "ClaimAddress_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "WarrantyClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
