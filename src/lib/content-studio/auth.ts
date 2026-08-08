import "server-only";

import { ensureLabPage, requireLabCapability } from "@/lib/lab-access";

/** Content & Creator Studio — server actions. */
export async function requireContentStudioAccess() {
  return requireLabCapability("lab.content_studio");
}

/** Versi untuk halaman/layout: redirect alih-alih melempar. */
export async function ensureContentStudioPage() {
  const { session } = await ensureLabPage("lab.content_studio");
  return session;
}
