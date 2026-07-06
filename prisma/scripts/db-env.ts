/**
 * Helper bersama untuk script DB yang dijalankan langsung via tsx (di luar
 * Prisma CLI / Next.js, yang memuat .env sendiri). Membaca DATABASE_URL dari
 * env, dengan fallback parse .env di root project.
 */
import fs from "node:fs";
import path from "node:path";

export function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const envPath = path.resolve(__dirname, "../../.env");
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, "utf8");
    const match = raw.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+?)"?\s*$/m);
    if (match?.[1]) return match[1];
  }

  console.error("DATABASE_URL tidak ditemukan di environment maupun .env.");
  process.exit(1);
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function isLocalDatabase(databaseUrl: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(databaseUrl).hostname);
  } catch {
    // URL tidak bisa diparse — anggap remote agar guard tetap ketat.
    return false;
  }
}

export function describeDatabaseHost(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    return `${url.hostname}${url.port ? `:${url.port}` : ""}`;
  } catch {
    return "(host tidak dikenali)";
  }
}
