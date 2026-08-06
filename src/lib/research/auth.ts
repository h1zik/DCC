import "server-only";

import { auth } from "@/lib/auth";
import { canAccessLabResearchHub } from "@/lib/roles";

export async function requireMarketAnalyst() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Belum masuk.");
  }
  if (!canAccessLabResearchHub(session.user.role)) {
    throw new Error(
      "Akses ditolak — hanya Market Analyst, Project Manager, atau Administrator.",
    );
  }
  return session;
}

/** Alias eksplisit untuk halaman & action Research Hub. */
export const requireResearchHubAccess = requireMarketAnalyst;
