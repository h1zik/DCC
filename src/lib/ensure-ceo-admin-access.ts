import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasAdministratorAccess } from "@/lib/roles";

/** Kelola pengguna & hak akses — administrator & CEO. */
export async function ensureAdminUserAccess() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasAdministratorAccess(session.user.role)) {
    redirect("/home");
  }
  return session;
}
