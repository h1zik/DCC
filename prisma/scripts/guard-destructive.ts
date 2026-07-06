/**
 * Pagar untuk perintah DB destruktif (mis. db:clear-projects).
 *
 * Lolos otomatis hanya jika DATABASE_URL menunjuk ke database lokal
 * (localhost / 127.0.0.1 / ::1). Untuk database remote — kemungkinan besar
 * production — script berhenti kecuali FORCE_DESTRUCTIVE_DB=1 di-set secara
 * eksplisit, supaya data tim tidak terhapus karena salah jalan perintah.
 */
import { describeDatabaseHost, isLocalDatabase, loadDatabaseUrl } from "./db-env";

const databaseUrl = loadDatabaseUrl();

if (isLocalDatabase(databaseUrl)) {
  process.exit(0);
}

if (process.env.FORCE_DESTRUCTIVE_DB === "1") {
  console.warn(
    `⚠️  FORCE_DESTRUCTIVE_DB=1 — perintah destruktif diizinkan terhadap database remote (${describeDatabaseHost(databaseUrl)}).`,
  );
  process.exit(0);
}

console.error(
  [
    "⛔ Perintah destruktif DIBATALKAN.",
    "",
    `DATABASE_URL menunjuk ke database remote: ${describeDatabaseHost(databaseUrl)}`,
    "Kemungkinan ini database PRODUCTION yang berisi data tim.",
    "",
    "Jika benar-benar yakin (sudah backup dulu via `npm run db:backup`),",
    "jalankan ulang dengan environment variable FORCE_DESTRUCTIVE_DB=1.",
  ].join("\n"),
);
process.exit(1);
