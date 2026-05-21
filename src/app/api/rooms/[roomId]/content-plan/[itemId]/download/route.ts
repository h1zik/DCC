import { createReadStream } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { zipSync } from "fflate";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember } from "@/lib/room-access";
import {
  listContentPlanStoredFilePaths,
  sanitizeContentPlanDownloadLabel,
  zipEntryNameForContentPlanFile,
} from "@/lib/content-plan-files";
import { absolutePathFromStoredPublicPath } from "@/lib/upload-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ roomId: string; itemId: string }> };

function attachmentDisposition(filename: string): string {
  return `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function guessContentType(filePath: string): string {
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

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await access(absPath);
    const st = await stat(absPath);
    return st.isFile();
  } catch {
    return false;
  }
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await requireTasksRoomHubSession();
    const { roomId, itemId } = await params;
    await assertRoomMember(roomId, session.user.id);

    const row = await prisma.roomContentPlanItem.findUnique({
      where: { id: itemId },
      select: {
        roomId: true,
        konten: true,
        copywritingFilePath: true,
        designFilePaths: true,
      },
    });
    if (!row || row.roomId !== roomId) {
      return new NextResponse("Baris tidak ditemukan.", { status: 404 });
    }

    const publicPaths = listContentPlanStoredFilePaths(row);
    if (publicPaths.length === 0) {
      return new NextResponse("Tidak ada file untuk diunduh.", { status: 404 });
    }

    const label = sanitizeContentPlanDownloadLabel(row.konten, itemId);
    const resolved: { abs: string; zipName: string }[] = [];
    let designIdx = 0;
    for (const publicPath of publicPaths) {
      const abs = absolutePathFromStoredPublicPath(publicPath);
      if (!abs || !(await fileExists(abs))) continue;
      const isCopy = publicPath === row.copywritingFilePath?.trim();
      resolved.push({
        abs,
        zipName: isCopy
          ? zipEntryNameForContentPlanFile(publicPath, "copywriting")
          : zipEntryNameForContentPlanFile(publicPath, "design", designIdx++),
      });
    }

    if (resolved.length === 0) {
      return new NextResponse("File fisik tidak ditemukan.", { status: 410 });
    }

    if (resolved.length === 1) {
      const { abs } = resolved[0]!;
      const filename = path.basename(abs);
      const st = await stat(abs);
      const stream = createReadStream(abs);
      const webStream = Readable.toWeb(stream) as unknown as ReadableStream;
      return new NextResponse(webStream, {
        status: 200,
        headers: {
          "Content-Type": guessContentType(abs),
          "Content-Length": String(st.size),
          "Content-Disposition": attachmentDisposition(filename),
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const zipFilename = `${label}.zip`;
    const zipEntries: Record<string, Uint8Array> = {};
    for (const entry of resolved) {
      const buf = await readFile(entry.abs);
      zipEntries[entry.zipName] = new Uint8Array(buf);
    }
    const zipped = zipSync(zipEntries);

    return new NextResponse(zipped, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(zipped.byteLength),
        "Content-Disposition": attachmentDisposition(zipFilename),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal mengunduh.";
    const status = message.includes("Unauthorized") || message.includes("autentikasi")
      ? 401
      : message.includes("anggota")
        ? 403
        : 500;
    return new NextResponse(message, { status });
  }
}
