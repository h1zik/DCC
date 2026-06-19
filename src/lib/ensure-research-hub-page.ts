import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessResearchHub } from "@/lib/roles";

export async function ensureResearchHubPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAccessResearchHub(session.user.role)) {
    redirect("/home");
  }
  return session;
}
