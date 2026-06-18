import "server-only";

import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";

export async function requireBrandManager() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Belum masuk.");
  }
  if (session.user.role !== UserRole.PROJECT_MANAGER) {
    throw new Error("Akses ditolak — hanya Brand Manager (Project Manager).");
  }
  return session;
}