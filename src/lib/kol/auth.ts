import "server-only";

import { KOL_APPROVE_CAPABILITY } from "@/lib/capabilities";
import {
  ensureLabPage,
  hasLabCapability,
  requireLabCapability,
} from "@/lib/lab-access";

/** KOL Hub — server actions. Melempar bila kapabilitas belum diberikan. */
export async function requireKolUser() {
  return requireLabCapability("lab.kol");
}

/** Versi untuk halaman/layout: redirect alih-alih melempar. */
export async function ensureKolHubPage() {
  const { session, access } = await ensureLabPage("lab.kol");
  return { session, access };
}

/** Approver KOL Hub (`lab.kol.approve`) — melempar bila bukan approver. */
export async function requireKolApprover() {
  const session = await requireKolUser();
  if (!(await hasLabCapability(KOL_APPROVE_CAPABILITY))) {
    throw new Error(
      "Hanya approver KOL Hub yang bisa menyetujui atau menolak pengajuan.",
    );
  }
  return session;
}

export async function canApproveKol(): Promise<boolean> {
  return hasLabCapability(KOL_APPROVE_CAPABILITY);
}

/**
 * Pengaju tidak boleh memutus pengajuannya sendiri — pemisahan tugas yang
 * sama dengan approval spend request Finance.
 */
export function assertNotSelfApproval(
  requestedById: string | null,
  approverId: string,
) {
  if (requestedById && requestedById === approverId) {
    throw new Error(
      "Pengajuan ini milikmu sendiri — minta approver lain untuk memutuskannya.",
    );
  }
}
