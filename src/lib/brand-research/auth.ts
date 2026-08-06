import "server-only";

import { auth } from "@/lib/auth";
import { canAccessLabBrandHub } from "@/lib/roles";

/** Brand & Creative Hub — Brand Manager (Project Manager) & Administrator. */
export async function requireBrandManager() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Belum masuk.");
  }
  if (!canAccessLabBrandHub(session.user.role)) {
    throw new Error(
      "Akses ditolak — hanya Brand Manager (Project Manager) atau Administrator.",
    );
  }
  return session;
}