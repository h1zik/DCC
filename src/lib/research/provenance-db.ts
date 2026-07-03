import "server-only";

import { ScrapeDataProvenance } from "@prisma/client";
import type { ScrapeDataProvider } from "@/lib/research/scrape-data-provider";

/**
 * Map provider runtime ("vps" | "apify" | …) ke enum DB `ScrapeDataProvenance`.
 * Provider non-scrape (dataforseo/google_trends/internal) tidak dipetakan —
 * kolom provenance khusus jalur scrape marketplace/sosial/review.
 */
export function toDbProvenance(
  provider: ScrapeDataProvider,
): ScrapeDataProvenance | null {
  switch (provider) {
    case "vps":
      return ScrapeDataProvenance.VPS;
    case "apify":
      return ScrapeDataProvenance.APIFY;
    case "native":
      return ScrapeDataProvenance.NATIVE;
    case "csv":
      return ScrapeDataProvenance.CSV;
    case "demo":
      return ScrapeDataProvenance.DEMO;
    default:
      return null;
  }
}

/** Kebalikan {@link toDbProvenance} — untuk badge UI dari kolom tersimpan. */
export function fromDbProvenance(
  provenance: ScrapeDataProvenance,
): ScrapeDataProvider {
  switch (provenance) {
    case ScrapeDataProvenance.VPS:
      return "vps";
    case ScrapeDataProvenance.APIFY:
      return "apify";
    case ScrapeDataProvenance.NATIVE:
      return "native";
    case ScrapeDataProvenance.CSV:
      return "csv";
    case ScrapeDataProvenance.DEMO:
      return "demo";
  }
}
