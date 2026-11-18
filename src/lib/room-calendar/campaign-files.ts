import "server-only";

import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rm, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { sanitizeRoomDocumentBaseName } from "@/lib/room-document-upload";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";

/**
 * Direktori akar lampiran campaign. SENGAJA di luar `getUploadPublicDir()`
 * agar route publik `/uploads/[...path]` (tanpa auth) tidak pernah bisa
 * menjangkaunya. File hanya dilayani lewat
 * `/api/room-campaigns/[campaignId]/attachments/[attachmentId]`, yang
 * memeriksa keanggotaan ruangan.
 */
export function getCampaignUploadRoot(): string {
  const fromEnv = process.env.CAMPAIGN_UPLOAD_DIR?.trim();
  if (fromEnv) {
    return path.resolve(/* turbopackIgnore: true */ fromEnv);
  }
  const railwayMount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  if (railwayMount) {
    return path.resolve(
      /* turbopackIgnore: true */
      path.join(/* turbopackIgnore: true */ railwayMount, "room-campaigns"),
    );
  }
  if (process.env.NODE_ENV === "production" && process.env.RAILWAY_ENVIRONMENT) {
    // Sibling dari default "/data/uploads" di upload-storage.ts.
    return "/data/room-campaigns";
  }
  return path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "uploads",
    "room-campaigns",
  );
}

/** Id campaign (cuid) dipakai sebagai nama folder; tolak apa pun selain itu. */
function campaignDir(campaignId: string): string {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(campaignId)) {
    throw new Error("Id campaign tidak valid.");
  }
  return path.join(getCampaignUploadRoot(), campaignId);
}

/**
 * Simpan file ke `<root>/<campaignId>/<uuid>-<nama>` secara streaming (tanpa
 * Buffer utuh di heap). Mengembalikan storagePath relatif terhadap root.
 */
export async function saveCampaignFile(params: {
  campaignId: string;
  fileName: string;
  size: number;
  body: ReadableStream<Uint8Array>;
}): Promise<{ storagePath: string; bytesWritten: number }> {
  if (params.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`);
  }

  const stored = `${randomUUID()}-${sanitizeRoomDocumentBaseName(params.fileName)}`;
  const absDir = campaignDir(params.campaignId);
  await mkdir(absDir, { recursive: true });
  const absFile = path.join(absDir, stored);

  let bytesWritten = 0;
  try {
    const sourceWithCount = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytesWritten += chunk.byteLength;
        if (bytesWritten > MAX_UPLOAD_BYTES) {
          controller.error(new Error(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`));
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
    storagePath: path.posix.join(params.campaignId, stored),
    bytesWritten,
  };
}

/** Resolve absolute path dengan penolakan path traversal (defense in depth). */
export function resolveCampaignFilePath(storagePath: string): string {
  const root = getCampaignUploadRoot();
  const normalized = path.normalize(storagePath).replace(/^([\\/])+/, "");
  const full = path.resolve(root, normalized);
  const rel = path.relative(root, full);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path file tidak valid.");
  }
  return full;
}

/** Hapus satu file fisik. Dianggap berhasil jika file memang sudah tidak ada. */
export async function removeCampaignFileBestEffort(storagePath: string) {
  try {
    await unlink(resolveCampaignFilePath(storagePath));
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return;
    console.warn(`[campaign-files] gagal hapus file ${storagePath}:`, e);
  }
}

/**
 * Hapus folder file milik campaign yang sudah dihapus. Best-effort: kegagalan
 * di sini tidak boleh membatalkan penghapusan campaign, view, atau ruangan.
 */
export async function removeCampaignFoldersBestEffort(campaignIds: readonly string[]) {
  for (const id of campaignIds) {
    try {
      await rm(campaignDir(id), { recursive: true, force: true });
    } catch (e) {
      console.warn(`[campaign-files] gagal hapus folder campaign ${id}:`, e);
    }
  }
}
