ALTER TABLE "ProductModel" ADD COLUMN "claimPhotoLimit" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "ProductModel" ADD CONSTRAINT "ProductModel_claimPhotoLimit_check" CHECK ("claimPhotoLimit" BETWEEN 0 AND 3);
