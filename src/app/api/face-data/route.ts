import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAttendanceAdmin } from "@/lib/attendance";

/**
 * GET /api/face-data
 * Mengembalikan data wajah milik user yang sedang login — dipakai untuk
 * verifikasi 1:1 saat absensi. Data wajah user lain tidak pernah diekspos.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }

  const faceData = await prisma.faceData.findMany({
    where: { userId: session.user.id },
    select: { descriptor: true, label: true },
  });

  return NextResponse.json({ userId: session.user.id, faceData });
}

/**
 * POST /api/face-data
 * Menyimpan (registrasi / registrasi ulang) data wajah user yang login.
 * Body: { descriptors: { descriptor: number[128]; label: string }[] }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const descriptors = (body as { descriptors?: unknown })?.descriptors;
  if (!Array.isArray(descriptors) || descriptors.length === 0) {
    return NextResponse.json(
      { error: "Data wajah wajib diisi" },
      { status: 400 },
    );
  }

  const clean: { descriptor: number[]; label: string }[] = [];
  for (const d of descriptors) {
    const item = d as { descriptor?: unknown; label?: unknown };
    if (
      !Array.isArray(item.descriptor) ||
      item.descriptor.length !== 128 ||
      !item.descriptor.every((n) => typeof n === "number")
    ) {
      return NextResponse.json(
        { error: "Format descriptor wajah tidak valid" },
        { status: 400 },
      );
    }
    clean.push({
      descriptor: item.descriptor as number[],
      label: typeof item.label === "string" ? item.label : "face",
    });
  }

  const userId = session.user.id;

  // Ganti seluruh data wajah lama dengan yang baru (atomic).
  await prisma.$transaction([
    prisma.faceData.deleteMany({ where: { userId } }),
    prisma.faceData.createMany({
      data: clean.map((d) => ({
        userId,
        descriptor: JSON.stringify(d.descriptor),
        label: d.label,
      })),
    }),
  ]);

  return NextResponse.json({ count: clean.length }, { status: 201 });
}

/**
 * DELETE /api/face-data
 * Menghapus data wajah. Tanpa query = hapus milik sendiri.
 * `?userId=<id>` = hapus milik user lain (khusus CEO / Administrator).
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }

  const targetUserId = new URL(request.url).searchParams.get("userId");
  let userId = session.user.id;

  if (targetUserId && targetUserId !== session.user.id) {
    if (!isAttendanceAdmin(session.user.role)) {
      return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
    }
    userId = targetUserId;
  }

  const result = await prisma.faceData.deleteMany({ where: { userId } });
  return NextResponse.json({ deleted: result.count });
}
