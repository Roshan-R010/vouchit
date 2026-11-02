ALTER TABLE "ClaimCost" ADD COLUMN "label" TEXT;
ALTER TABLE "ClaimCost" ADD CONSTRAINT "ClaimCost_label_check" CHECK ("label" IS NULL OR length(btrim("label")) BETWEEN 1 AND 120);
