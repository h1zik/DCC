import "server-only";

import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";

/**
 * Direktori akar file Space Pribadi. SENGAJA di luar `getUploadPublicDir()`
 * (public/uploads lokal, `<mount>/uploads` di Railway) agar route publik
 * `/uploads/[...path]` — yang tanpa auth — tidak pernah bisa menjangkaunya.
 * File hanya dilayani lewat `/api/personal/files/[fileId]/download` yang
 * memverifikasi kepemilikan.
 */
export function getPersonalUploadRoot(): string {
  const fromEnv = process.env.PERSONAL_UPLOAD_DIR?.trim();
  if (fromEnv) {
    return path.resolve(/* turbopackIgnore: true */ fromEnv);
  }
  const railwayMount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  if (railwayMount) {
    return path.resolve(
      /* turbopackIgnore: true */
      path.join(/* turbopackIgnore: true */ railwayMount, "personal"),
    );
  }
  if (process.env.NODE_ENV === "production" && process.env.RAILWAY_ENVIRONMENT) {
    // Sibling dari default "/data/uploads" di upload-storage.ts.
    return "/data/personal";
  }
  return path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "uploads",
    "personal",
  );
}

/** Bersihkan nama file agar aman sebagai path segment. */
export function safePersonalFileName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120) || "file";
}

/**
 * Simpan file ke `<root>/<ownerId>/<uuid>-<nama>` secara streaming (tanpa
 * Buffer utuh di heap). Mengembalikan storagePath relatif terhadap root.
 */
export async function savePersonalFileToDisk(params: {
  ownerId: string;
  fileName: string;
  size: number;
  body: ReadableStream<Uint8Array>;
}): Promise<{ storagePath: string; bytesWritten: number }> {
  if (params.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`);
  }

  const stored = `${randomUUID()}-${safePersonalFileName(params.fileName)}`;
  const absDir = path.join(getPersonalUploadRoot(), params.ownerId);
  await mkdir(absDir, { recursive: true });
  const absFile = path.join(absDir, stored);

  let bytesWritten = 0;
  try {
    const sourceWithCount = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytesWritten += chunk.byteLength;
        if (bytesWritten > MAX_UPLOAD_BYTES) {
          controller.error(
            new Error(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`),
          );
          return;
        }
        controller.enqueue(chunk);
      },
    });
    await pipeline(
      Readable.fromWeb(params.body.pipeThrough(sourceWithCount) as never),
      createWriteStream(absFile),
    );
  } catch (err) {
    await unlink(absFile).catch(() => undefined);
    throw err;
  }

  return {
    storagePath: path.posix.join(params.ownerId, stored),
    bytesWritten,
  };
}

/** Resolve absolute path dengan penolakan path traversal (defense in depth). */
export function resolvePersonalFilePath(storagePath: string): string {
  const root = getPersonalUploadRoot();
  const normalized = path.normalize(storagePath).replace(/^([\\/])+/, "");
  const full = path.resolve(root, normalized);
  const rel = path.relative(root, full);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path file tidak valid.");
  }
  return full;
}

/** Cek apakah file masih ada di disk. */
export async function personalFileExists(storagePath: string): Promise<boolean> {
  try {
    await stat(resolvePersonalFilePath(storagePath));
    return true;
  } catch {
    return false;
  }
}

/** Hapus file fisik. Dianggap berhasil jika file memang sudah tidak ada. */
export async function removePersonalFileBestEffort(storagePath: string) {
  try {
    await unlink(resolvePersonalFilePath(storagePath));
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return;
    console.warn(`[personal-file-storage] gagal hapus file ${storagePath}:`, e);
  }
}
