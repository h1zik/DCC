import { createReadStream, type ReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { Zip, ZipPassThrough } from "fflate";
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

/**
 * ZIP streaming: file dibaca dari disk per-chunk dan langsung dialirkan ke
 * respons — tidak pernah menampung seluruh folder di RAM, dan kompresi tidak
 * memblokir event loop (entri disimpan store/tanpa deflate; isi dokumen
 * mayoritas media yang sudah terkompresi).
 */
function createZipStream(
  files: { abs: string; zipName: string }[],
): ReadableStream<Uint8Array> {
  let aborted = false;
  let current: ReadStream | null = null;
  let zip: Zip | null = null;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      zip = new Zip((err, chunk, final) => {
        if (aborted) return;
        if (err) {
          aborted = true;
          controller.error(err);
          return;
        }
        controller.enqueue(chunk);
        if (final) controller.close();
      });

      (async () => {
        for (const file of files) {
          if (aborted) return;
          const entry = new ZipPassThrough(file.zipName);
          zip!.add(entry);
          await new Promise<void>((resolve, reject) => {
            const rs = createReadStream(file.abs);
            current = rs;
            rs.on("data", (chunk) => {
              entry.push(
                chunk instanceof Uint8Array
                  ? chunk
                  : new TextEncoder().encode(String(chunk)),
                false,
              );
              // Backpressure: berhenti baca disk bila antrean respons penuh;
              // dilanjutkan lagi oleh pull() saat client menguras antrean.
              if ((controller.desiredSize ?? 1) <= 0) rs.pause();
            });
            rs.on("end", () => {
              entry.push(new Uint8Array(0), true);
              resolve();
            });
            rs.on("error", reject);
          });
          current = null;
        }
        zip!.end();
      })().catch((err) => {
        if (!aborted) {
          aborted = true;
          controller.error(err);
        }
      });
    },
    pull() {
      current?.resume();
    },
    cancel() {
      // Client putus di tengah unduhan: hentikan baca disk agar fd tak bocor.
      aborted = true;
      current?.destroy();
      zip?.terminate();
    },
  });
}

/** Bangun respons unduh: satu file langsung, banyak file → zip (streaming). */
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
    const { abs, zipName } = resolved[0]!;
    const filename = path.basename(zipName);
    const st = await stat(abs);
    const stream = Readable.toWeb(createReadStream(abs)) as unknown as ReadableStream;
    return new NextResponse(stream, {
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
  // Tanpa Content-Length — ukuran zip streaming tidak diketahui di muka.
  return new NextResponse(createZipStream(resolved), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": attachmentDisposition(zipFilename),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
