import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isMarketAnalyst } from "@/lib/roles";
import {
  canAccessWorkspaceDashboard,
  getWorkspaceDashboardData,
} from "@/lib/workspace-dashboard/get-dashboard-data";
import { OperationsCommandCenter } from "@/components/workspace-dashboard/operations-command-center";

export default async function WorkspaceDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!canAccessWorkspaceDashboard(session.user.role)) {
    if (isMarketAnalyst(session.user.role)) redirect("/research-hub");
    redirect("/login");
  }

  const data = await getWorkspaceDashboardData(session);

  return <OperationsCommandCenter data={data} />;
}
