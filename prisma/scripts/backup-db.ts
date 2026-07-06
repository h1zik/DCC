/**
 * Backup database ke file lokal via pg_dump (format custom, bisa di-restore
 * dengan pg_restore). Jalankan SEBELUM perubahan schema di production:
 *
 *   npm run db:backup
 *
 * Butuh PostgreSQL client tools (pg_dump) terpasang dan ada di PATH.
 * File tersimpan di ./backups/ (di-gitignore, jangan di-commit).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describeDatabaseHost, loadDatabaseUrl } from "./db-env";

const databaseUrl = loadDatabaseUrl();

const backupDir = path.resolve(__dirname, "../../backups");
fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date()
  .toISOString()
  .replace(/[:T]/g, "-")
  .replace(/\..+$/, "");
const outFile = path.join(backupDir, `dcc-${stamp}.dump`);

console.log(`Membackup database ${describeDatabaseHost(databaseUrl)} → ${outFile}`);

const result = spawnSync("pg_dump", ["--format=custom", `--file=${outFile}`, databaseUrl], {
  stdio: ["ignore", "inherit", "inherit"],
});

if (result.error && (result.error as NodeJS.ErrnoException).code === "ENOENT") {
  console.error(
    [
      "⛔ pg_dump tidak ditemukan di PATH.",
      "",
      "Pasang PostgreSQL client tools terlebih dahulu:",
      "  - Windows: https://www.postgresql.org/download/windows/ (cukup komponen 'Command Line Tools')",
      "  - lalu pastikan folder bin PostgreSQL masuk PATH.",
      "",
      "Alternatif: gunakan fitur backup dari hosting database (mis. Railway/Neon/Supabase)",
      "sebelum menjalankan perubahan schema di production.",
    ].join("\n"),
  );
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`⛔ pg_dump gagal (exit code ${result.status ?? "?"}). Backup TIDAK tersimpan.`);
  try {
    fs.rmSync(outFile, { force: true });
  } catch {}
  process.exit(result.status ?? 1);
}

const sizeMb = (fs.statSync(outFile).size / 1024 / 1024).toFixed(2);
console.log(`✅ Backup selesai: ${outFile} (${sizeMb} MB)`);
console.log("   Restore bila perlu: pg_restore --clean --if-exists -d <DATABASE_URL> <file>");
