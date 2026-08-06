import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSession } from "@/lib/get-session";
import { getNavRoomStructure } from "@/lib/room-nav-data";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  // Backstop auth: tiap page (dashboard) idealnya self-guard, tapi ini mencegah
  // page baru yang lupa cek auth jadi world-readable.
  if (!session?.user?.id) {
    redirect("/login");
  }
  // Struktur nav ter-cache; badge unread live diambil client-side oleh
  // RoomNavProvider agar layout tidak query pesan di tiap navigasi.
  const navRooms = session.user.role
    ? await getNavRoomStructure(session.user.id, session.user.role)
    : [];

  // VoiceProvider sengaja TIDAK di sini — lihat komentarnya di
  // components/providers.tsx (call harus selamat saat pindah ke Dominatus Lab).
  return <DashboardShell navRooms={navRooms}>{children}</DashboardShell>;
}
