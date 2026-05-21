import { readFile, access, stat } from "node:fs/promises";
import path from "node:path";
import { zipSync } from "fflate";
import { NextResponse } from "next/server";
import { absolutePathFromStoredPublicPath } from "@/lib/upload-storage";
import type { RoomDocumentZipEntry } from "@/lib/room-document-download";

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

/** Bangun respons unduh: satu file langsung, banyak file → zip. */
export async function buildDocumentDownloadResponse(
  entries: RoomDocumentZipEntry[],
  zipBasename: string,
): Promise<NextResponse> {
  const resolved: { abs: string; zipName: string }[] = [];
  for (const entry of entries) {
    const abs = absolutePathFromStoredPublicPath(entry.publicPath);
    if (!abs || !(await fileExists(abs))) continue;
    resolved.push({ abs, zipName: entry.zipName });
  }

  if (resolved.length === 0) {
    return new NextResponse("File fisik tidak ditemukan.", { status: 410 });
  }

  if (resolved.length === 1) {
    const { abs } = resolved[0]!;
    const filename = path.basename(abs);
    const st = await stat(abs);
    const buf = await readFile(abs);
    return new NextResponse(buf, {
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

  const zipFilename = `${zipBasename}.zip`;
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
}
