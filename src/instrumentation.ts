/**
 * Hook instrumentation Next.js — `register()` dipanggil SEKALI tiap instance
 * server dinyalakan (sebelum melayani request).
 *
 * Tugas: auto-sync katalog gamifikasi (cosmetics + achievements) dari kode ke DB
 * saat boot, dijaga hash-versi supaya nyaris selalu no-op. Artinya tak perlu lagi
 * `npm run db:seed-gamification` manual di produksi — deploy → boot → katalog sinkron.
 *
 * Hanya jalan di runtime Node.js (butuh Prisma). Import katalog dilakukan dinamis
 * agar tak ikut ter-bundle ke runtime Edge. Semua error ditelan (fail-open):
 * kegagalan sync tak boleh mencegah server melayani request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SKIP_GAMIFICATION_CATALOG_SYNC === "1") return;

  try {
    const { ensureGamificationCatalog } = await import(
      "@/lib/gamification/catalog"
    );
    const result = await ensureGamificationCatalog();
    if (result.applied) {
      console.log(
        `[gamification] katalog disinkronkan (versi ${result.version}).`,
      );
    }
  } catch (err) {
    console.error("[gamification] gagal sinkronisasi katalog saat boot:", err);
  }
}
