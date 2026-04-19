import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isStudioOrProjectManager } from "@/lib/roles";

/** Pipeline / proyek: CEO (baca) atau tim studio (kelola). */
export async function ensurePipelineAccess() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (
    session.user.role !== UserRole.CEO &&
    !isStudioOrProjectManager(session.user.role)
  ) {
    redirect("/login");
  }
  return session;
}
