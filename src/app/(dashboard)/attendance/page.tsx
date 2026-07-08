import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayDateString } from "@/lib/attendance";
import { AttendanceClient } from "./attendance-client";
import type { AttendanceRow } from "./types";

export const dynamic = "force-dynamic";

/**
 * Halaman absensi mandiri — dapat diakses semua peran yang sudah login.
 * Karyawan men-scan wajahnya sendiri (verifikasi 1:1) untuk check-in/out.
 */
export default async function AttendancePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  // Freelance tidak ikut absensi — blokir akses (baca dari DB agar otoritatif
  // walau token JWT masih basi).
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { employmentType: true },
  });
  if (me?.employmentType === "FREELANCE") redirect("/");

  const today = getTodayDateString();

  const [faceCount, records] = await Promise.all([
    prisma.faceData.count({ where: { userId } }),
    prisma.attendance.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }, { timestamp: "desc" }],
      take: 60,
    }),
  ]);

  const historyRows: AttendanceRow[] = records.map((r) => ({
    id: r.id,
    type: r.type,
    timestamp: r.timestamp.toISOString(),
    date: r.date,
    confidence: r.confidence,
    reason: r.reason,
    todoList: r.todoList,
    completedTasks: r.completedTasks,
  }));

  const todayRows = historyRows.filter((r) => r.date === today);

  return (
    <div className="flex w-full flex-col gap-6">
      <AttendanceClient
        hasFace={faceCount > 0}
        userName={session.user.name?.trim() || session.user.email || "Anda"}
        todayRows={todayRows}
        historyRows={historyRows}
      />
    </div>
  );
}
