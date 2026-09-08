-- Jenis konten baru: Story. Tidak pernah masuk simulasi feed (aturan di aplikasi).
ALTER TYPE "ContentPlanJenis" ADD VALUE IF NOT EXISTS 'STORY';
