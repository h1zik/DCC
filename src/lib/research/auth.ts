import "server-only";

import { auth } from "@/lib/auth";
import { canAccessResearchHub } from "@/lib/roles";

export async function requireMarketAnalyst() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Belum masuk.");
  }
  if (!canAccessResearchHub(session.user.role)) {
    throw new Error(
      "Akses ditolak — hanya Market Analyst atau Project Manager.",
    );
  }
  return session;
}

/** Alias eksplisit untuk halaman & action Research Hub. */
export const requireResearchHubAccess = requireMarketAnalyst;
