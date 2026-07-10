/**
 * CLI seed katalog gamifikasi profil — kini hanya pembungkus tipis.
 *
 * Definisi katalog & runner idempotent ada di `src/lib/gamification/catalog.ts`
 * (sumber kebenaran tunggal, dipakai bersama oleh auto-sync `instrumentation.ts`).
 * Di PRODUKSI kamu TIDAK perlu menjalankan ini manual: katalog auto-sync saat
 * server boot bila definisinya berubah. Script ini berguna untuk memaksa sync
 * lokal / setelah edit katalog:
 *
 *   npx tsx prisma/scripts/seed-gamification.ts
 *   (atau `npm run db:seed-gamification`)
 */
import { prisma } from "../../src/lib/prisma";
import { seedGamificationCatalog } from "../../src/lib/gamification/catalog";

async function main() {
  const result = await seedGamificationCatalog();
  console.log(
    `Seed gamifikasi selesai: ${result.cosmetics} cosmetics, ${result.achievements} achievements.`,
  );
}

// Jalankan hanya bila dipanggil langsung (bukan saat di-import).
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
