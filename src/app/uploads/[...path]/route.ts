import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { resolveUploadFileFromUrlSegments } from "@/lib/upload-storage";

export const runtime = "nodejs";

function guessContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".json": "application/json",
    ".xml": "application/xml",
    ".zip": "application/zip",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return map[ext] ?? "application/octet-stream";
}

/**
 * File di `/uploads/...` di-namespace dengan UUID per upload (lihat
 * `room-document-upload.ts`). Artinya setiap path bersifat *immutable* —
 * konten file tidak akan pernah berubah di URL yang sama. Aman untuk cache
 * panjang dengan flag `immutable`.
 */
function buildCacheControl(): string {
  return "private, max-age=31536000, immutable";
}

function buildContentDisposition(absPath: string): string {
  const safe = path.basename(absPath).replace(/"/g, "");
  return `inline; filename="${safe}"`;
}

/** Parse `Range: bytes=start-end` (single range only — cukup untuk video/PDF/dll). */
function parseSingleRange(
  header: string | null,
  total: number,
): { start: number; end: number } | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const startStr = m[1];
  const endStr = m[2];
  let start: number;
  let end: number;
  if (startStr === "" && endStr === "") return null;
  if (startStr === "") {
    // Suffix range: `bytes=-N` → N byte terakhir.
    const suffix = Number(endStr);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else {
    start = Number(startStr);
    end = endStr === "" ? total - 1 : Number(endStr);
  }
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < start ||
    start >= total
  ) {
    return null;
  }
  if (end >= total) end = total - 1;
  return { start, end };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path: segments } = await ctx.params;
  if (!segments?.length) {
    return new Response(null, { status: 404 });
  }

  const abs = resolveUploadFileFromUrlSegments(segments);
  if (!abs) {
    return new Response(null, { status: 400 });
  }

  let st;
  try {
    st = await stat(abs);
    if (!st.isFile()) {
      return new Response(null, { status: 404 });
    }
  } catch {
    return new Response(null, { status: 404 });
  }

  const total = st.size;
  const contentType = guessContentType(abs);
  const lastModified = st.mtime.toUTCString();
  // ETag berbasis ukuran + mtime — stabil per file, regenerasi saat file ditulis ulang.
  const etag = `W/"${total.toString(16)}-${Math.trunc(st.mtimeMs).toString(16)}"`;

  const baseHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": buildCacheControl(),
    "Content-Disposition": buildContentDisposition(abs),
    "Accept-Ranges": "bytes",
    "Last-Modified": lastModified,
    ETag: etag,
  };

  // Conditional GET — hemat bandwidth saat browser/CDN punya cache.
  const ifNoneMatch = req.headers.get("if-none-match");
  const ifModifiedSince = req.headers.get("if-modified-since");
  if (
    (ifNoneMatch && ifNoneMatch === etag) ||
    (!ifNoneMatch &&
      ifModifiedSince &&
      Number.isFinite(Date.parse(ifModifiedSince)) &&
      Date.parse(ifModifiedSince) >= Math.trunc(st.mtimeMs / 1000) * 1000)
  ) {
    return new Response(null, { status: 304, headers: baseHeaders });
  }

  // HEAD — kembalikan metadata saja.
  if (req.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: { ...baseHeaders, "Content-Length": String(total) },
    });
  }

  // Range request — wajib untuk seek video/audio dan progresif PDF.
  const rangeHeader = req.headers.get("range");
  if (rangeHeader) {
    const range = parseSingleRange(rangeHeader, total);
    if (!range) {
      return new Response(null, {
        status: 416,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes */${total}`,
        },
      });
    }
    const { start, end } = range;
    const chunkSize = end - start + 1;
    const stream = createReadStream(abs, { start, end });
    const webStream = Readable.toWeb(stream);
    return new Response(webStream as unknown as BodyInit, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Length": String(chunkSize),
      },
    });
  }

  // Full-body response.
  const stream = createReadStream(abs);
  const webStream = Readable.toWeb(stream);
  return new Response(webStream as unknown as BodyInit, {
    status: 200,
    headers: {
      ...baseHeaders,
      "Content-Length": String(total),
    },
  });
}

export async function HEAD(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  return GET(req, ctx);
}
