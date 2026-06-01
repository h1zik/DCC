import { NextRequest, NextResponse } from "next/server";
import { Prisma, AttendanceType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getTodayDateString,
  isAttendanceAdmin,
  isValidAttendanceType,
} from "@/lib/attendance";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const userSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
  role: true,
  customRole: { select: { name: true } },
} satisfies Prisma.UserSelect;

/**
 * GET /api/attendance — daftar catatan absensi.
 * Non-admin hanya bisa melihat catatannya sendiri; CEO/Administrator bisa
 * memfilter semua user. Filter: date | startDate+endDate | type | userId.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }

  const sp = new URL(request.url).searchParams;
  const date = sp.get("date");
  const startDate = sp.get("startDate");
  const endDate = sp.get("endDate");
  const type = sp.get("type");
  const requestedUserId = sp.get("userId");

  const admin = isAttendanceAdmin(session.user.role);
  const where: Prisma.AttendanceWhereInput = {};

  // Scoping: user biasa terkunci ke datanya sendiri.
  where.userId = admin
    ? requestedUserId || undefined
    : session.user.id;

  if (date && DATE_RE.test(date)) {
    where.date = date;
  } else if (startDate || endDate) {
    const range: Prisma.StringFilter = {};
    if (startDate && DATE_RE.test(startDate)) range.gte = startDate;
    if (endDate && DATE_RE.test(endDate)) range.lte = endDate;
    where.date = range;
  }

  if (type && isValidAttendanceType(type)) {
    where.type = type as AttendanceType;
  }

  const records = await prisma.attendance.findMany({
    where,
    include: { user: { select: userSelect } },
    orderBy: [{ date: "desc" }, { timestamp: "desc" }],
    take: 2000,
  });

  return NextResponse.json(records);
}

/**
 * POST /api/attendance — mencatat absensi UNTUK DIRI SENDIRI.
 * `userId` selalu diambil dari sesi (tidak bisa absen atas nama orang lain).
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const { type, confidence, todoList, completedTasks, reason } = body;

  if (!isValidAttendanceType(type)) {
    return NextResponse.json(
      { error: "Jenis absensi tidak valid" },
      { status: 400 },
    );
  }

  const isAbsence = type === "SICK" || type === "PERMISSION";
  if (isAbsence && (typeof reason !== "string" || reason.trim() === "")) {
    return NextResponse.json(
      { error: "Alasan wajib diisi" },
      { status: 400 },
    );
  }

  const userId = session.user.id;
  const today = getTodayDateString();

  // Cegah double-submit dalam 15 detik terakhir.
  const last = await prisma.attendance.findFirst({
    where: { userId, date: today },
    orderBy: { timestamp: "desc" },
  });
  if (last) {
    const diffSeconds = (Date.now() - last.timestamp.getTime()) / 1000;
    if (diffSeconds < 15) {
      return NextResponse.json(
        { error: "Mohon tunggu sebentar sebelum absen lagi." },
        { status: 429 },
      );
    }
  }

  const created = await prisma.attendance.create({
    data: {
      userId,
      type: type as AttendanceType,
      date: today,
      confidence: isAbsence ? 0 : Number(confidence) || 0,
      reason: isAbsence ? (reason as string).trim() : null,
      todoList:
        Array.isArray(todoList) && todoList.length > 0
          ? JSON.stringify(todoList)
          : null,
      completedTasks:
        Array.isArray(completedTasks) && completedTasks.length > 0
          ? JSON.stringify(completedTasks)
          : null,
    },
    include: { user: { select: userSelect } },
  });

  return NextResponse.json(created, { status: 201 });
}

/**
 * DELETE /api/attendance?beforeDate=YYYY-MM-DD — hapus catatan lama.
 * Khusus CEO / Administrator.
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }
  if (!isAttendanceAdmin(session.user.role)) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const beforeDate = new URL(request.url).searchParams.get("beforeDate");
  if (!beforeDate || !DATE_RE.test(beforeDate)) {
    return NextResponse.json(
      { error: "beforeDate wajib diisi (format: YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const result = await prisma.attendance.deleteMany({
    where: { date: { lt: beforeDate } },
  });

  return NextResponse.json({ deleted: result.count });
}
