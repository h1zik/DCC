-- Opsi cepat untuk lingkungan dev: hapus semua proyek (tugas & checklist ikut CASCADE).
-- Setelah ini, `npx prisma db push` biasanya berhasil tanpa error roomId.
-- Jalankan lalu `npx prisma db seed` bila perlu data demo.

DELETE FROM "Project";
