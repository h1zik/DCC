import "server-only";

import { ensureLabPage, requireLabCapability } from "@/lib/lab-access";

/** SEO Toolkit — server actions. Melempar bila kapabilitas belum diberikan. */
export async function requireSeoAccess() {
  return requireLabCapability("lab.seo");
}

/** Versi untuk halaman/layout: redirect alih-alih melempar. */
export async function ensureSeoPage() {
  const { session } = await ensureLabPage("lab.seo");
  return session;
}
