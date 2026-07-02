import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { auth } from "@/lib/auth";
import { getNavRooms } from "@/lib/room-nav-data";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  // Backstop auth: tiap page (dashboard) idealnya self-guard, tapi ini mencegah
  // page baru yang lupa cek auth jadi world-readable.
  if (!session?.user?.id) {
    redirect("/login");
  }
  const navRooms = session.user.role
    ? await getNavRooms(session.user.id, session.user.role)
    : [];

  return <DashboardShell navRooms={navRooms}>{children}</DashboardShell>;
}
