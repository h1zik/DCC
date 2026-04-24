import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isStudioOrProjectManager } from "@/lib/roles";

/** Pipeline / proyek: CEO/admin (monitor) atau tim studio/PM (kelola). */
export async function ensurePipelineAccess() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (
    session.user.role !== UserRole.CEO &&
    session.user.role !== UserRole.ADMINISTRATOR &&
    !isStudioOrProjectManager(session.user.role)
  ) {
    redirect("/tasks");
  }
  return session;
}
