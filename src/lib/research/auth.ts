import "server-only";

import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";

export async function requireMarketAnalyst() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Belum masuk.");
  }
  if (session.user.role !== UserRole.MARKET_ANALYST) {
    throw new Error("Akses ditolak — hanya Market Analyst.");
  }
  return session;
}
