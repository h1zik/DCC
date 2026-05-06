import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Halaman modul keuangan hanya untuk peran Finance. */
export async function ensureFinancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== UserRole.FINANCE) redirect("/");
}
