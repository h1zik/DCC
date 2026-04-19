import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function ensureCeoApprovalsAccess() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== UserRole.CEO) redirect("/");
  return session;
}
