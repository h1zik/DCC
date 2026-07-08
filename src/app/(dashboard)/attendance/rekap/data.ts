import { format, subDays } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { effectiveRoleLabel } from "@/lib/role-labels";
import { getTodayDateString } from "@/lib/attendance";

export type EmployeeStatus =
  | "PRESENT"
  | "DONE"
  | "SICK"
  | "PERMISSION"
  | "ABSENT";

export interface DashboardData {
  todayStats: {
    checkIn: number;
    checkOut: number;
    sick: number;
    permission: number;
    present: number;
    totalUsers: number;
    registered: number;
  };
  weekly: { label: string; hadir: number; absen: number }[];
  byRole: { role: string; hadir: number; total: number }[];
  statuses: {
    name: string;
    role: string;
    status: EmployeeStatus;
    checkIn: string | null;
    checkOut: string | null;
  }[];
  recent: {
    id: string;
    type: string;
    name: string;
    role: string;
    time: string;
  }[];
}

export interface RegistrationRow {
  id: string;
  name: string;
  email: string;
  role: string;
  faceCount: number;
  attendanceCount: number;
  lastDate: string | null;
}

const STATUS_RANK: Record<EmployeeStatus, number> = {
  PRESENT: 0,
  DONE: 1,
  SICK: 2,
  PERMISSION: 3,
  ABSENT: 4,
};

/**
 * Mengumpulkan seluruh data untuk halaman rekap absensi (dashboard +
 * daftar registrasi wajah). Dijalankan di server.
 */
export async function getAttendanceAdminData(): Promise<{
  dashboard: DashboardData;
  registrations: RegistrationRow[];
}> {
  const today = getTodayDateString();
  const last7 = Array.from({ length: 7 }, (_, i) =>
    format(subDays(new Date(), 6 - i), "yyyy-MM-dd"),
  );

  const [todayRecords, weekRecords, users] = await Promise.all([
    prisma.attendance.findMany({
      where: { date: today },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            customRole: { select: { name: true } },
          },
        },
      },
      orderBy: { timestamp: "desc" },
    }),
    prisma.attendance.findMany({
      where: { date: { in: last7 } },
      select: { date: true, type: true, userId: true },
    }),
    prisma.user.findMany({
      // Hanya pekerja tetap yang masuk daftar absensi — freelance dikecualikan.
      where: { employmentType: "EMPLOYEE" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        customRole: { select: { name: true } },
        _count: { select: { faceData: true, attendances: true } },
        attendances: {
          orderBy: { timestamp: "desc" },
          take: 1,
          select: { date: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const roleLabelOf = (u: {
    role: (typeof users)[number]["role"];
    customRole: { name: string } | null;
  }) => effectiveRoleLabel({ role: u.role, customRole: u.customRole });

  const nameOf = (u: { name: string | null; email: string }) =>
    u.name?.trim() || u.email;

  // ----- Statistik hari ini -----
  const presentToday = new Set(
    todayRecords.filter((r) => r.type === "CHECK_IN").map((r) => r.userId),
  );
  const todayStats = {
    checkIn: todayRecords.filter((r) => r.type === "CHECK_IN").length,
    checkOut: todayRecords.filter((r) => r.type === "CHECK_OUT").length,
    sick: todayRecords.filter((r) => r.type === "SICK").length,
    permission: todayRecords.filter((r) => r.type === "PERMISSION").length,
    present: presentToday.size,
    totalUsers: users.length,
    registered: users.filter((u) => u._count.faceData > 0).length,
  };

  // ----- Grafik 7 hari -----
  const weekly = last7.map((date) => {
    const day = weekRecords.filter((r) => r.date === date);
    const hadir = new Set(
      day.filter((r) => r.type === "CHECK_IN").map((r) => r.userId),
    ).size;
    const absen = day.filter(
      (r) => r.type === "SICK" || r.type === "PERMISSION",
    ).length;
    return {
      label: format(new Date(`${date}T00:00:00`), "EEE", { locale: idLocale }),
      hadir,
      absen,
    };
  });

  // ----- Rekap per peran -----
  const roleGroups = new Map<string, { total: number; hadir: number }>();
  for (const u of users) {
    const label = roleLabelOf(u);
    const g = roleGroups.get(label) ?? { total: 0, hadir: 0 };
    g.total += 1;
    if (presentToday.has(u.id)) g.hadir += 1;
    roleGroups.set(label, g);
  }
  const byRole = [...roleGroups.entries()]
    .map(([role, g]) => ({ role, hadir: g.hadir, total: g.total }))
    .sort((a, b) => b.total - a.total);

  // ----- Status per karyawan hari ini -----
  const statuses = users
    .map((u) => {
      const recs = todayRecords.filter((r) => r.userId === u.id);
      const checkIn = recs.find((r) => r.type === "CHECK_IN");
      const checkOut = recs.find((r) => r.type === "CHECK_OUT");
      const sick = recs.find((r) => r.type === "SICK");
      const permission = recs.find((r) => r.type === "PERMISSION");

      let status: EmployeeStatus = "ABSENT";
      if (sick) status = "SICK";
      else if (permission) status = "PERMISSION";
      else if (checkOut) status = "DONE";
      else if (checkIn) status = "PRESENT";

      return {
        name: nameOf(u),
        role: roleLabelOf(u),
        status,
        checkIn: checkIn ? format(checkIn.timestamp, "HH:mm") : null,
        checkOut: checkOut ? format(checkOut.timestamp, "HH:mm") : null,
      };
    })
    .sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        a.name.localeCompare(b.name),
    );

  // ----- Aktivitas terkini -----
  const recent = todayRecords.slice(0, 12).map((r) => ({
    id: r.id,
    type: r.type as string,
    name: nameOf(r.user),
    role: roleLabelOf(r.user),
    time: format(r.timestamp, "HH:mm:ss"),
  }));

  // ----- Daftar registrasi wajah -----
  const registrations: RegistrationRow[] = users.map((u) => ({
    id: u.id,
    name: nameOf(u),
    email: u.email,
    role: roleLabelOf(u),
    faceCount: u._count.faceData,
    attendanceCount: u._count.attendances,
    lastDate: u.attendances[0]?.date ?? null,
  }));

  return {
    dashboard: { todayStats, weekly, byRole, statuses, recent },
    registrations,
  };
}
