-- Hanya untuk upgrade dari enum lama. Jangan jalankan jika `db push` sudah
-- membuat enum dengan nilai MARKET_RESEARCH, PRODUCT_DEVELOPMENT, … (cek: \dT+ "PipelineStage").
--
-- Jalankan SEKALI pada database PostgreSQL yang masih memakai enum lama:
-- IDEA, R_AND_D, DESIGN, SAMPLING, PRODUCTION, LAUNCH
-- Setelah itu skema Prisma dengan MARKET_RESEARCH, …, PRELAUNCH, LAUNCH akan cocok.
-- Untuk database baru (db push dari nol), script ini tidak diperlukan.

ALTER TYPE "PipelineStage" RENAME VALUE 'IDEA' TO 'MARKET_RESEARCH';
ALTER TYPE "PipelineStage" RENAME VALUE 'R_AND_D' TO 'PRODUCT_DEVELOPMENT';
ALTER TYPE "PipelineStage" RENAME VALUE 'DESIGN' TO 'BRAND_AND_DESIGN';
ALTER TYPE "PipelineStage" RENAME VALUE 'SAMPLING' TO 'PANEL_TESTING';
-- Gagal jika PRELAUNCH sudah ada (abaikan jika script dijalankan ulang).
ALTER TYPE "PipelineStage" ADD VALUE 'PRELAUNCH' AFTER 'PRODUCTION';

ALTER TABLE "Project" ALTER COLUMN "currentStage" DROP DEFAULT;
ALTER TABLE "Project" ALTER COLUMN "currentStage" SET DEFAULT 'MARKET_RESEARCH'::"PipelineStage";
ALTER TABLE "Product" ALTER COLUMN "pipelineStage" DROP DEFAULT;
ALTER TABLE "Product" ALTER COLUMN "pipelineStage" SET DEFAULT 'MARKET_RESEARCH'::"PipelineStage";
