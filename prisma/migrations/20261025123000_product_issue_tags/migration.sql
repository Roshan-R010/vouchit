ALTER TABLE "ProductModel"
  ADD COLUMN "issueTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Keep the selected labels on each claim, even if the brand edits its tags later.
ALTER TABLE "WarrantyClaim"
  ADD COLUMN "issueTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "ProductModel" ADD CONSTRAINT "ProductModel_issueTags_limit"
  CHECK (cardinality("issueTags") <= 6);
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_issueTags_limit"
  CHECK (cardinality("issueTags") <= 6);
