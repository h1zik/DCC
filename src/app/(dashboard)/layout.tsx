import { DashboardShell } from "@/components/dashboard-shell";
import { auth } from "@/lib/auth";
import { getNavRooms } from "@/lib/room-nav-data";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const navRooms =
    session?.user?.id && session.user.role
      ? await getNavRooms(session.user.id, session.user.role)
      : [];

  return <DashboardShell navRooms={navRooms}>{children}</DashboardShell>;
}
