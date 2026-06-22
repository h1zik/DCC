import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import {
  assertRoomMemberHasTaskPhase,
  getTaskRoomContext,
} from "@/lib/room-access";
import { absolutePathFromStoredPublicPath } from "@/lib/upload-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ attachmentId: string }> };

function attachmentDisposition(filename: string): string {
  return `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function guessContentType(filePath: string, mimeType: string): string {
  if (mimeType && mimeType !== "application/octet-stream") {
    return mimeType;
  }
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".zip": "application/zip",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return map[ext] ?? "application/octet-stream";
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await requireTasksRoomHubSession();
    const { attachmentId } = await params;

    const attachment = await prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        publicPath: true,
        linkUrl: true,
        taskId: true,
      },
    });
    if (!attachment?.publicPath) {
      return new NextResponse("Lampiran tidak ditemukan.", { status: 404 });
    }
    if (!attachment.publicPath.startsWith("/uploads/tasks/")) {
      return new NextResponse("Path tidak valid.", { status: 400 });
    }

    const { roomId, phase } = await getTaskRoomContext(attachment.taskId);
    await assertRoomMemberHasTaskPhase(roomId, session.user.id, phase);

    const abs = absolutePathFromStoredPublicPath(attachment.publicPath);
    if (!abs) {
      return new NextResponse("File fisik tidak ditemukan.", { status: 410 });
    }

    const st = await stat(abs);
    if (!st.isFile()) {
      return new NextResponse("File fisik tidak ditemukan.", { status: 410 });
    }

    const buf = await readFile(abs);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": guessContentType(abs, attachment.mimeType),
        "Content-Length": String(st.size),
        "Content-Disposition": attachmentDisposition(attachment.fileName),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal mengunduh.";
    const status = message.includes("Unauthorized") || message.includes("autentikasi")
      ? 401
      : message.includes("anggota") || message.includes("fase")
        ? 403
        : 500;
    return new NextResponse(message, { status });
  }
}
