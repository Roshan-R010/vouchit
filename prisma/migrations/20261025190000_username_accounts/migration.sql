CREATE TYPE "AccountRole" AS ENUM ('BRAND', 'CUSTOMER');

CREATE TABLE "Account" (
  "id" UUID NOT NULL,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "AccountRole" NOT NULL,
  "displayName" TEXT NOT NULL,
  "email" TEXT,
  "demoSessionId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Account_username_key" ON "Account"("username");
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");
CREATE UNIQUE INDEX "Account_demoSessionId_key" ON "Account"("demoSessionId");

CREATE TABLE "AuthSession" (
  "id" UUID NOT NULL,
  "accountId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Customer" ADD COLUMN "accountId" UUID;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Customer_accountId_idx" ON "Customer"("accountId");
