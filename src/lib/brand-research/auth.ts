import "server-only";

import { requireLabCapability } from "@/lib/lab-access";

/** Brand & Creative Hub — server actions. */
export async function requireBrandHubAccess() {
  return requireLabCapability("lab.brand_hub");
}

/** @deprecated Nama lama dari era akses berbasis peran. Pakai {@link requireBrandHubAccess}. */
export const requireBrandManager = requireBrandHubAccess;
