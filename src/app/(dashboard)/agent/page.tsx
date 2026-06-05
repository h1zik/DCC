import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canUseAgent } from "@/lib/agent/access";
import { AgentPageClient } from "./agent-page-client";

export default async function AgentPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    role: session.user.role,
  };

  if (!canUseAgent(user)) {
    redirect("/login");
  }

  return <AgentPageClient />;
}
