import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdministrator, isStudioOrProjectManager } from "@/lib/roles";

export async function ensureStudioTeamAccess() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStudioOrProjectManager(session.user.role)) {
    redirect("/login");
  }
  return session;
}

/** Menu Tugas & Kanban dan hub /room/* — CEO, administrator, atau tim studio / PM. */
export async function ensureTasksAndRoomHubAccess() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (
    session.user.role !== UserRole.CEO &&
    !isAdministrator(session.user.role) &&
    !isStudioOrProjectManager(session.user.role)
  ) {
    redirect("/login");
  }
  return session;
}
