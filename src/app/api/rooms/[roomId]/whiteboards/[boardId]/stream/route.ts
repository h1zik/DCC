import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/board-access";
import {
  listPresence,
  publish,
  subscribeBoard,
  type WhiteboardEphemeralMessage,
} from "@/lib/whiteboard/bus";

/**
 * Aliran realtime papan (Server-Sent Events).
 *
 * Klien menerima dua hal:
 *  - `rev`      — papan berubah, tarik delta dari endpoint `/sync`.
 *  - ephemeral  — kursor, seleksi, dan pratinjau geser peserta lain.
 *
 * Sinyal `rev` datang dari dua sumber: bus in-memory (instan, untuk peserta
 * di instance yang sama) **dan** penelusuran `rev` papan langsung ke database
 * setiap beberapa ratus milidetik. Penelusuran DB itu yang menjamin
 * perubahan tetap sampai walaupun aplikasi dijalankan lebih dari satu
 * instance — bus hanya mempersingkat latensinya.
 */

export const dynamic = "force-dynamic";
/** SSE butuh proses Node yang persisten, bukan edge runtime. */
export const runtime = "nodejs";
export const maxDuration = 3600;

type Ctx = { params: Promise<{ roomId: string; boardId: string }> };

/** Interval penelusuran `rev` papan ke database. */
const DB_TAIL_INTERVAL_MS = 1200;
/** Ping berkala agar proxy tidak menutup koneksi yang dianggap idle. */
const HEARTBEAT_INTERVAL_MS = 20_000;
/** Umur maksimum satu koneksi SSE; klien menyambung ulang otomatis. */
const MAX_STREAM_MS = 25 * 60 * 1000;

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
  const selfSessionId = url.searchParams.get("sessionId")?.slice(0, 64) ?? null;

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let dbTail: ReturnType<typeof setInterval> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let lifetime: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          cleanup();
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe?.();
        if (dbTail) clearInterval(dbTail);
        if (heartbeat) clearInterval(heartbeat);
        if (lifetime) clearTimeout(lifetime);
        try {
          controller.close();
        } catch {
          // Sudah tertutup dari sisi klien.
        }
      };

      // Revisi yang sudah dikirim ke klien ini — mencegah sinyal duplikat
      // dari bus dan penelusuran DB.
      let lastRev = 0;
      const board = await prisma.roomWhiteboard.findUnique({
        where: { id: boardId },
        select: { rev: true },
      });
      lastRev = board?.rev ?? 0;

      send("ready", { rev: lastRev, presence: listPresence(boardId) });

      unsubscribe = subscribeBoard(boardId, (message: WhiteboardEphemeralMessage) => {
        if (message.kind === "rev") {
          if (message.rev <= lastRev) return;
          lastRev = message.rev;
          send("rev", { rev: message.rev, origin: message.sessionId });
          return;
        }
        // Jangan pantulkan balik pesan ephemeral milik pengirimnya sendiri.
        const from =
          message.kind === "presence" ? message.presence.sessionId : message.sessionId;
        if (selfSessionId && from === selfSessionId) return;
        send(message.kind, message);
      });

      dbTail = setInterval(() => {
        void (async () => {
          if (closed) return;
          try {
            const current = await prisma.roomWhiteboard.findUnique({
              where: { id: boardId },
              select: { rev: true },
            });
            if (!current) {
              send("gone", {});
              cleanup();
              return;
            }
            if (current.rev > lastRev) {
              lastRev = current.rev;
              send("rev", { rev: current.rev, origin: null });
            }
          } catch {
            // Kegagalan sesaat ke DB tidak perlu memutus stream.
          }
        })();
      }, DB_TAIL_INTERVAL_MS);

      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, HEARTBEAT_INTERVAL_MS);

      lifetime = setTimeout(() => {
        send("reconnect", {});
        cleanup();
      }, MAX_STREAM_MS);

      req.signal.addEventListener("abort", () => {
        if (selfSessionId) {
          publish({ kind: "leave", boardId, sessionId: selfSessionId });
        }
        cleanup();
      });
    },
    cancel() {
      closed = true;
      unsubscribe?.();
      if (dbTail) clearInterval(dbTail);
      if (heartbeat) clearInterval(heartbeat);
      if (lifetime) clearTimeout(lifetime);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Cegah buffering oleh reverse proxy (nginx & sejenisnya).
      "X-Accel-Buffering": "no",
    },
  });
}
