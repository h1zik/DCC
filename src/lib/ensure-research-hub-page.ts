import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function ensureResearchHubPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== UserRole.MARKET_ANALYST) {
    redirect("/");
  }
  return session;
}
