import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Halaman kelola ruangan — administrator. */
export async function ensureAdministratorRoomsAccess() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== UserRole.ADMINISTRATOR) {
    redirect("/tasks");
  }
  return session;
}
