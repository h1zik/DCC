/**
 * Kebijakan reset data finance (tombol "Bersihkan" / clearAllFinanceDemoData).
 *
 * Aksi tersebut menghapus SELURUH isi modul finance (ledger, jurnal, AP/AR,
 * bank, kurs, budget, aset). Itu hanya masuk akal di lingkungan demo/sandbox —
 * di produksi satu klik memusnahkan pembukuan riil. Modul ini menggate-nya:
 *  - Di produksi, reset DIBLOKIR secara default.
 *  - Di non-produksi (dev lokal) reset diizinkan untuk kenyamanan demo.
 *  - Kedua default bisa dioverride dengan FINANCE_DEMO_RESET=true|false.
 *
 * Pola mengikuti `demo-data-policy.ts` (gate ALLOW_DEMO_DATA untuk scraper).
 */

/** Frasa yang wajib diketik user sebelum reset dijalankan. */
export const FINANCE_DEMO_RESET_CONFIRM_PHRASE = "HAPUS FINANCE";

/**
 * Inti kebijakan — murni agar mudah diuji.
 * `flag` = nilai FINANCE_DEMO_RESET, `nodeEnv` = NODE_ENV.
 */
export function resolveFinanceDemoResetAllowed(
  flag: string | undefined,
  nodeEnv: string | undefined,
): boolean {
  const f = flag?.trim().toLowerCase();
  if (f === "true" || f === "1" || f === "yes") return true;
  if (f === "false" || f === "0" || f === "no") return false;
  // Default: hanya di luar produksi.
  return nodeEnv !== "production";
}

export function isFinanceDemoResetAllowed(): boolean {
  return resolveFinanceDemoResetAllowed(
    process.env.FINANCE_DEMO_RESET,
    process.env.NODE_ENV,
  );
}

/** Throw bila reset finance tidak diizinkan di lingkungan ini. */
export function assertFinanceDemoResetAllowed(): void {
  if (isFinanceDemoResetAllowed()) return;
  throw new Error(
    "Reset data finance dinonaktifkan di produksi. " +
      "Set FINANCE_DEMO_RESET=true secara eksplisit hanya bila lingkungan ini memang sandbox/demo.",
  );
}
