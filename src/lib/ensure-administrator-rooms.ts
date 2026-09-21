import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasAdministratorAccess } from "@/lib/roles";

/** Halaman kelola ruangan — administrator & CEO. */
export async function ensureAdministratorRoomsAccess() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasAdministratorAccess(session.user.role)) {
    redirect("/tasks");
  }
  return session;
}
