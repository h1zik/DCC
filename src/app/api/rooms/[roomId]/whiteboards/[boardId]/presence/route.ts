import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/board-access";
import { publish } from "@/lib/whiteboard/bus";

/**
 * Kanal *ephemeral* papan: kursor, seleksi, dan pratinjau geser/resize yang
 * belum di-commit.
 *
 * Tidak pernah menyentuh database — pesan hanya diteruskan ke peserta lain
 * yang sedang membuka papan yang sama. Kalau hilang, tidak ada data yang
 * hilang; state sebenarnya selalu datang dari endpoint `/sync`.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ roomId: string; boardId: string }> };

const draftElementSchema = z.object({
  id: z.string().min(1).max(64),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  width: z.number().finite().min(0).optional(),
  height: z.number().finite().min(0).optional(),
  rotation: z.number().finite().optional(),
  points: z
    .array(z.tuple([z.number(), z.number(), z.number()]))
    .max(4000)
    .optional(),
});

const bodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("presence"),
    sessionId: z.string().min(1).max(64),
    cursor: z
      .object({ x: z.number().finite(), y: z.number().finite() })
      .nullable()
      .default(null),
    selection: z.array(z.string().max(64)).max(500).default([]),
    tool: z.string().max(32).default("select"),
  }),
  z.object({
    kind: z.literal("draft"),
    sessionId: z.string().min(1).max(64),
    elements: z.array(draftElementSchema).max(500),
  }),
  z.object({
    kind: z.literal("draft-end"),
    sessionId: z.string().min(1).max(64),
  }),
  z.object({
    kind: z.literal("leave"),
    sessionId: z.string().min(1).max(64),
  }),
]);

export async function POST(req: Request, { params }: Ctx) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }
  const payload = parsed.data;

  switch (payload.kind) {
    case "presence":
      publish({
        kind: "presence",
        boardId,
        presence: {
          sessionId: payload.sessionId,
          userId: session.user.id,
          name: session.user.name?.trim() || session.user.email || "Anggota",
          image: session.user.image ?? null,
          cursor: payload.cursor,
          selection: payload.selection,
          tool: payload.tool,
          updatedAt: Date.now(),
        },
      });
      break;
    case "draft":
      publish({
        kind: "draft",
        boardId,
        sessionId: payload.sessionId,
        elements: payload.elements,
      });
      break;
    case "draft-end":
      publish({ kind: "draft-end", boardId, sessionId: payload.sessionId });
      break;
    case "leave":
      publish({ kind: "leave", boardId, sessionId: payload.sessionId });
      break;
  }

  return new Response(null, { status: 204 });
}
