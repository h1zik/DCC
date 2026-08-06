import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessLabResearchHub } from "@/lib/roles";

export async function ensureResearchHubPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAccessLabResearchHub(session.user.role)) {
    redirect("/home");
  }
  return session;
}
