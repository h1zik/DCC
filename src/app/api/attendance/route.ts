import { NextRequest, NextResponse } from "next/server";
import { Prisma, AttendanceType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getTodayDateString,
  isAttendanceAdmin,
  isValidAttendanceType,
} from "@/lib/attendance";
import { getLatestAttendanceSession } from "@/lib/attendance-state";
import { normalizeAttendanceDetails } from "@/lib/attendance-details";
import {
  evaluateAchievements,
  isProfileGamificationEnabled,
  onVerifiedCheckIn,
} from "@/lib/gamification";

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

  const normalizedTodoList = normalizeAttendanceDetails(todoList ?? []);
  const normalizedCompletedTasks = normalizeAttendanceDetails(
    completedTasks ?? [],
  );
  if (!normalizedTodoList.ok) {
    return NextResponse.json(
      { error: normalizedTodoList.error },
      { status: 400 },
    );
  }
  if (!normalizedCompletedTasks.ok) {
    return NextResponse.json(
      { error: normalizedCompletedTasks.error },
      { status: 400 },
    );
  }

  const userId = session.user.id;
  const today = getTodayDateString();

  // Ambil semua catatan hari ini (terbaru lebih dulu) untuk validasi status.
  const todayRecords = await prisma.attendance.findMany({
    where: { userId, date: today },
    orderBy: { timestamp: "desc" },
  });

  // 1) Cegah double-tap pada tombol yang SAMA (kepencet 2x) dalam 15 detik.
  //    Hanya berlaku per-jenis, jadi check-in lalu langsung check-out tetap bisa.
  const lastSameType = todayRecords.find((r) => r.type === type);
  if (lastSameType) {
    const diffSeconds = (Date.now() - lastSameType.timestamp.getTime()) / 1000;
    if (diffSeconds < 15) {
      return NextResponse.json(
        { error: "Mohon tunggu sebentar sebelum absen lagi." },
        { status: 429 },
      );
    }
  }

  // 2) State-machine masuk/pulang. Status saat ini ditentukan oleh event
  //    CHECK_IN / CHECK_OUT paling akhir hari ini.
  const attendanceSession = getLatestAttendanceSession(todayRecords);
  const currentlyCheckedIn = attendanceSession.state === "CHECKED_IN";

  if (type === "CHECK_IN" && currentlyCheckedIn) {
    return NextResponse.json(
      { error: "Anda sudah check-in. Silakan check-out terlebih dahulu." },
      { status: 409 },
    );
  }
  if (type === "CHECK_OUT") {
    if (attendanceSession.state === "NOT_STARTED") {
      return NextResponse.json(
        { error: "Anda belum check-in hari ini." },
        { status: 409 },
      );
    }
    if (!currentlyCheckedIn) {
      return NextResponse.json(
        {
          error:
            "Anda sudah check-out. Silakan check-in dulu untuk mulai kerja lagi.",
        },
        { status: 409 },
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
        type === "CHECK_IN" && normalizedTodoList.items.length > 0
          ? JSON.stringify(normalizedTodoList.items)
          : null,
      completedTasks:
        type === "CHECK_OUT" && normalizedCompletedTasks.items.length > 0
          ? JSON.stringify(normalizedCompletedTasks.items)
          : null,
    },
    include: { user: { select: userSelect } },
  });

  // Gamifikasi profil (fire-and-forget, di balik feature flag). Tak pernah
  // menggagalkan pencatatan absensi bila engine gamifikasi error.
  if (
    (await isProfileGamificationEnabled()) &&
    created.type === AttendanceType.CHECK_IN &&
    created.confidence > 0
  ) {
    void onVerifiedCheckIn({
      userId,
      date: created.date,
      timestamp: created.timestamp,
      employmentType: session.user.employmentType,
    })
      .then(() => evaluateAchievements(userId, { notify: true }))
      .catch((err) =>
        console.error("[gamification] attendance grant failed", err),
      );
  }

  return NextResponse.json(created, { status: 201 });
}

/** PATCH /api/attendance — mengubah keterangan absensi sendiri untuk hari ini. */
export async function PATCH(request: NextRequest) {
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

  const recordId = typeof body.id === "string" ? body.id.trim() : "";
  if (!recordId) {
    return NextResponse.json({ error: "Catatan tidak valid." }, { status: 400 });
  }

  const normalized = normalizeAttendanceDetails(body.items);
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const record = await prisma.attendance.findFirst({
    where: {
      id: recordId,
      userId: session.user.id,
      date: getTodayDateString(),
      type: { in: [AttendanceType.CHECK_IN, AttendanceType.CHECK_OUT] },
    },
    select: { id: true, type: true },
  });
  if (!record) {
    return NextResponse.json(
      { error: "Catatan tidak ditemukan atau sudah tidak dapat diubah." },
      { status: 404 },
    );
  }

  const serialized = normalized.items.length
    ? JSON.stringify(normalized.items)
    : null;
  const updated = await prisma.attendance.update({
    where: { id: record.id },
    data:
      record.type === AttendanceType.CHECK_IN
        ? { todoList: serialized }
        : { completedTasks: serialized },
  });

  return NextResponse.json(updated);
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
