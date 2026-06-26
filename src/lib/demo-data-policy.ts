/**
 * Central policy for synthetic "demo" data fallbacks.
 *
 * Every scraper in the Brand & Research hubs has a demo/seed fallback that runs
 * when the real provider (Apify / VPS / DataForSEO) is not configured. Historically
 * that fallback fired silently and wrote fabricated data into the same tables as
 * real data, marked READY — indistinguishable from genuine scrapes.
 *
 * This module gates that behaviour:
 *  - In production, demo data is BLOCKED by default. Scrapers must hard-fail with a
 *    clear "not configured" error instead of fabricating data.
 *  - In non-production (local dev) demo data is allowed for convenience.
 *  - Either default can be overridden with ALLOW_DEMO_DATA=true|false.
 *
 * When demo data IS allowed, callers must persist a demo marker / provenance so the
 * UI can render an honest "DEMO DATA" banner (see resolve-scrape-provenance.ts).
 */

export function isDemoDataAllowed(): boolean {
  const flag = process.env.ALLOW_DEMO_DATA?.trim().toLowerCase();
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  if (flag === "false" || flag === "0" || flag === "no") return false;
  // Default: allowed only outside production.
  return process.env.NODE_ENV !== "production";
}

/**
 * Throw when a scraper is unconfigured and demo data is not permitted.
 * Use at every demo fallback site so jobs fail loudly instead of fabricating data.
 */
export function assertDemoDataAllowed(providerHint: string): void {
  if (isDemoDataAllowed()) return;
  throw new Error(
    `${providerHint} belum dikonfigurasi. Set kredensial scraper (VPS/Apify/DataForSEO) ` +
      `atau aktifkan ALLOW_DEMO_DATA=true untuk memakai data demo. ` +
      `Data demo dinonaktifkan di produksi agar tidak ada data palsu yang tersimpan.`,
  );
}
