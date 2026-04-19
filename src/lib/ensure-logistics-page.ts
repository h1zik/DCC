import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Halaman operasional hanya untuk staf logistik; CEO diarahkan ke dashboard. */
export async function ensureLogisticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== UserRole.LOGISTICS) redirect("/");
}
