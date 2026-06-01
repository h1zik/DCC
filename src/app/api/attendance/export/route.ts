import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAttendanceAdmin } from "@/lib/attendance";
import { effectiveRoleLabel } from "@/lib/role-labels";
import { ATTENDANCE_TYPE_LABELS } from "@/lib/attendance-constants";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/attendance/export?startDate=&endDate=
 * Mengunduh rekap absensi sebagai CSV. Khusus CEO / Administrator.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }
  if (!isAttendanceAdmin(session.user.role)) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const sp = new URL(request.url).searchParams;
  const startDate = sp.get("startDate");
  const endDate = sp.get("endDate");

  const where: Prisma.AttendanceWhereInput = {};
  const validStart = startDate && DATE_RE.test(startDate) ? startDate : null;
  const validEnd = endDate && DATE_RE.test(endDate) ? endDate : null;
  if (validStart || validEnd) {
    const range: Prisma.StringFilter = {};
    if (validStart) range.gte = validStart;
    if (validEnd) range.lte = validEnd;
    where.date = range;
  }

  const records = await prisma.attendance.findMany({
    where,
    include: {
      user: {
        select: {
          name: true,
          email: true,
          role: true,
          customRole: { select: { name: true } },
        },
      },
    },
    orderBy: [{ date: "desc" }, { timestamp: "desc" }],
  });

  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header = "Tanggal,Waktu,Nama,Peran,Status,Confidence,Alasan";

  const rows = records.map((r) => {
    const time = new Date(r.timestamp).toLocaleTimeString("id-ID");
    const name = r.user.name?.trim() || r.user.email;
    const role = effectiveRoleLabel({
      role: r.user.role,
      customRole: r.user.customRole,
    });
    const status = ATTENDANCE_TYPE_LABELS[r.type] ?? r.type;
    const conf =
      r.type === "SICK" || r.type === "PERMISSION"
        ? ""
        : r.confidence.toFixed(2);
    const reason = r.reason ? escape(r.reason) : "";
    return [r.date, time, escape(name), escape(role), status, conf, reason].join(
      ",",
    );
  });

  // BOM agar Excel membaca UTF-8 dengan benar.
  const csv = "﻿" + header + "\n" + rows.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="absensi-dominatus-${validStart || "all"}.csv"`,
    },
  });
}
