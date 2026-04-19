import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Halaman /brands — administrator. */
export async function ensureBrandPageAccess() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== UserRole.ADMINISTRATOR) {
    redirect("/tasks");
  }
}
