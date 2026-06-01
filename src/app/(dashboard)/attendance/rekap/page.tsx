import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAttendanceAdmin } from "@/lib/attendance";
import { getAttendanceAdminData } from "./data";
import { RekapClient } from "./rekap-client";

export const dynamic = "force-dynamic";

/**
 * Halaman rekap absensi — khusus CEO & Administrator.
 * Berisi dashboard kehadiran, rekap data, dan status registrasi wajah.
 */
export default async function AttendanceRekapPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isAttendanceAdmin(session.user.role)) redirect("/attendance");

  const { dashboard, registrations } = await getAttendanceAdminData();

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <RekapClient dashboard={dashboard} registrations={registrations} />
    </div>
  );
}
