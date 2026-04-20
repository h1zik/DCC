import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Kelola pengguna & hak akses — hanya administrator. */
export async function ensureAdminUserAccess() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== UserRole.ADMINISTRATOR) {
    redirect("/rooms");
  }
  return session;
}
