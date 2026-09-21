import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasAdministratorAccess } from "@/lib/roles";

/** Halaman /brands — administrator & CEO. */
export async function ensureBrandPageAccess() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasAdministratorAccess(session.user.role)) {
    redirect("/tasks");
  }
}
