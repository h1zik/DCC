import "server-only";

import { ensureLabPage, requireLabCapability } from "@/lib/lab-access";

/** Research Hub — server actions. Melempar bila kapabilitas belum diberikan. */
export async function requireResearchHubAccess() {
  return requireLabCapability("lab.research_hub");
}

/** @deprecated Nama lama dari era akses berbasis peran. Pakai {@link requireResearchHubAccess}. */
export const requireMarketAnalyst = requireResearchHubAccess;

/** Versi untuk halaman/layout: redirect alih-alih melempar. */
export async function ensureResearchHubPage() {
  const { session } = await ensureLabPage("lab.research_hub");
  return session;
}
