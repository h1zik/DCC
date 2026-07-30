import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/board-access";
import { publish } from "@/lib/whiteboard/bus";
import { rowToDelta } from "@/lib/whiteboard/serialize";
import { whiteboardMutationSchema } from "@/lib/whiteboard/types";

/**
 * Sinkronisasi isi papan whiteboard.
 *
 * `GET  ?since=<rev>` — ambil delta elemen yang berubah sejak revisi tertentu
 *                       (tanpa `since` = snapshot penuh).
 * `POST`              — kirim satu batch create/update/delete. Seluruh batch
 *                       jadi satu revisi papan supaya klien lain menerimanya
 *                       sebagai satu perubahan yang utuh.
 */

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ roomId: string; boardId: string }> };

const MAX_ELEMENTS_PER_BOARD = 10_000;

export async function GET(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }
  const { roomId, boardId } = await params;

  const access = await resolveWhiteboardAccess(boardId, session.user.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }
  if (access.context.roomId !== roomId) {
    return NextResponse.json({ error: "Papan tidak ditemukan." }, { status: 404 });
  }

  const url = new URL(req.url);
  const sinceRaw = url.searchParams.get("since");
  const since = sinceRaw === null ? null : Number.parseInt(sinceRaw, 10);
  const isDelta = since !== null && Number.isFinite(since) && since >= 0;

  const board = await prisma.roomWhiteboard.findUnique({
    where: { id: boardId },
    select: {
      id: true,
      title: true,
      rev: true,
      background: true,
      lastEditedAt: true,
      lastEditedById: true,
    },
  });
  if (!board) {
    return NextResponse.json({ error: "Papan tidak ditemukan." }, { status: 404 });
  }

  // Klien yang sudah mutakhir tidak perlu query elemen sama sekali.
  if (isDelta && since! >= board.rev) {
    return NextResponse.json({
      board,
      rev: board.rev,
      full: false,
      elements: [],
    });
  }

  const rows = await prisma.roomWhiteboardElement.findMany({
    where: isDelta
      ? { boardId, rev: { gt: since! } }
      : { boardId, deletedAt: null },
    orderBy: { zIndex: "asc" },
    take: MAX_ELEMENTS_PER_BOARD,
  });

  return NextResponse.json({
    board,
    rev: board.rev,
    full: !isDelta,
    elements: rows.map(rowToDelta),
  });
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }
  const userId = session.user.id;
  const { roomId, boardId } = await params;

  const access = await resolveWhiteboardAccess(boardId, userId);
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }
  if (access.context.roomId !== roomId) {
    return NextResponse.json({ error: "Papan tidak ditemukan." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }

  const parsed = whiteboardMutationSchema.safeParse(
    (body as { mutation?: unknown })?.mutation ?? body,
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Perubahan tidak valid.", detail: parsed.error.issues.slice(0, 5) },
      { status: 400 },
    );
  }
  const mutation = parsed.data;
  const rawSessionId = (body as { sessionId?: unknown })?.sessionId;
  const sessionId = typeof rawSessionId === "string" ? rawSessionId.slice(0, 64) : null;

  if (
    mutation.create.length === 0 &&
    mutation.update.length === 0 &&
    mutation.delete.length === 0
  ) {
    const current = await prisma.roomWhiteboard.findUnique({
      where: { id: boardId },
      select: { rev: true },
    });
    return NextResponse.json({ rev: current?.rev ?? 0, elements: [] });
  }

  if (mutation.create.length > 0) {
    const existing = await prisma.roomWhiteboardElement.count({
      where: { boardId, deletedAt: null },
    });
    if (existing + mutation.create.length > MAX_ELEMENTS_PER_BOARD) {
      return NextResponse.json(
        {
          error: `Papan sudah mencapai batas ${MAX_ELEMENTS_PER_BOARD.toLocaleString("id-ID")} objek. Buat papan baru atau hapus objek yang tidak dipakai.`,
        },
        { status: 409 },
      );
    }
  }

  let rev: number;
  try {
    rev = await prisma.$transaction(async (tx) => {
      const board = await tx.roomWhiteboard.update({
        where: { id: boardId },
        data: {
          rev: { increment: 1 },
          lastEditedById: userId,
          lastEditedAt: new Date(),
        },
        select: { rev: true },
      });
      const nextRev = board.rev;

      if (mutation.create.length > 0) {
        await tx.roomWhiteboardElement.createMany({
          data: mutation.create.map((el) => ({
            id: el.id,
            boardId,
            type: el.type,
            zIndex: el.zIndex,
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
            rotation: el.rotation,
            props: el.props as Prisma.InputJsonValue,
            locked: el.locked,
            frameId: el.frameId,
            rev: nextRev,
            createdById: userId,
            updatedById: userId,
          })),
          // Aman kalau klien mengirim ulang batch yang sama setelah timeout.
          skipDuplicates: true,
        });
      }

      if (mutation.update.length > 0) {
        // Satu query untuk berapa pun jumlah elemen: payload dibongkar oleh
        // `jsonb_to_recordset`, dan kolom yang tidak dikirim dibiarkan apa
        // adanya lewat COALESCE. `props` di-*merge* dangkal (`||`) supaya
        // mengubah satu atribut tidak menghapus atribut lain.
        const payload = mutation.update.map((patch) => ({
          id: patch.id,
          zIndex: patch.zIndex ?? null,
          x: patch.x ?? null,
          y: patch.y ?? null,
          width: patch.width ?? null,
          height: patch.height ?? null,
          rotation: patch.rotation ?? null,
          props: patch.props ?? null,
          locked: patch.locked ?? null,
          frameId: patch.frameId ?? null,
          frameIdSet: patch.frameId !== undefined,
        }));

        await tx.$executeRaw`
          UPDATE "RoomWhiteboardElement" AS e
          SET
            "zIndex"      = COALESCE(v."zIndex", e."zIndex"),
            x             = COALESCE(v.x, e.x),
            y             = COALESCE(v.y, e.y),
            width         = COALESCE(v.width, e.width),
            height        = COALESCE(v.height, e.height),
            rotation      = COALESCE(v.rotation, e.rotation),
            props         = CASE WHEN v.props IS NULL THEN e.props ELSE e.props || v.props END,
            locked        = COALESCE(v.locked, e.locked),
            "frameId"     = CASE WHEN v."frameIdSet" THEN v."frameId" ELSE e."frameId" END,
            rev           = ${nextRev}::integer,
            "updatedById" = ${userId},
            "updatedAt"   = NOW()
          FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS v(
            id text,
            "zIndex" integer,
            x double precision,
            y double precision,
            width double precision,
            height double precision,
            rotation double precision,
            props jsonb,
            locked boolean,
            "frameId" text,
            "frameIdSet" boolean
          )
          WHERE e.id = v.id
            AND e."boardId" = ${boardId}
            AND e."deletedAt" IS NULL
        `;
      }

      if (mutation.delete.length > 0) {
        await tx.roomWhiteboardElement.updateMany({
          where: { boardId, id: { in: mutation.delete }, deletedAt: null },
          data: {
            deletedAt: new Date(),
            rev: nextRev,
            updatedById: userId,
          },
        });
      }

      return nextRev;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Papan tidak ditemukan." }, { status: 404 });
    }
    throw error;
  }

  // Beri tahu peserta lain agar langsung menarik delta.
  publish({ kind: "rev", boardId, rev, sessionId });

  return NextResponse.json({ rev });
}
