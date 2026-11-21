-- Detail halaman produk pada hasil Product Discovery (Shopee `fetchDetail`).
-- Aditif: hanya kolom baru yang nullable / ber-default, tanpa backfill.
ALTER TABLE "ProductDiscoveryItem"
  ADD COLUMN "brand" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "categoryName" TEXT,
  ADD COLUMN "categoryPath" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "currency" TEXT,
  ADD COLUMN "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "priceMin" DOUBLE PRECISION,
  ADD COLUMN "priceMax" DOUBLE PRECISION,
  ADD COLUMN "attributes" JSONB,
  ADD COLUMN "variations" JSONB,
  ADD COLUMN "models" JSONB,
  ADD COLUMN "ratingDistribution" JSONB;
