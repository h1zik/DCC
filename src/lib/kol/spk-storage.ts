import "server-only";

import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Storage privat KOL Hub (SPK bertanda tangan berisi data pribadi KOL).
 * Di luar `public/` — file hanya bisa diunduh lewat route ber-auth
 * `/api/kol/spk/[docId]/signed`. Pola resolusi mengikuti lampiran Finance:
 * WAJIB di volume persisten saat di Railway.
 */
export function getKolUploadRoot(): string {
  const fromEnv = process.env.KOL_UPLOAD_DIR?.trim();
  if (fromEnv) return path.resolve(/* turbopackIgnore: true */ fromEnv);
  const railwayMount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  if (railwayMount) {
    return path.resolve(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ railwayMount, "kol"));
  }
  if (process.env.NODE_ENV === "production" && process.env.RAILWAY_ENVIRONMENT) {
    return "/data/kol";
  }
  return path.join(/* turbopackIgnore: true */ process.cwd(), "uploads", "kol");
}

const SPK_FOLDER = "spk";

export const SPK_SIGNED_MAX_BYTES = 10 * 1024 * 1024;
export const SPK_SIGNED_ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);

function safeFileName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120) || "file";
}

/** Simpan file ke `<root>/spk/<docId>/<stamp>-<nama>`; kembalikan path relatif. */
export async function saveSignedSpk(params: {
  docId: string;
  fileName: string;
  bytes: Buffer;
}): Promise<string> {
  // Subfolder dibentuk opak (bukan literal di path.join) supaya bundler tidak
  // menelusuri pola folder dan ikut membawa seluruh proyek ke output server.
  const folder = [SPK_FOLDER, params.docId].join("/");
  const dir = path.join(getKolUploadRoot(), folder);
  await mkdir(/* turbopackIgnore: true */ dir, { recursive: true });
  const filename = `${Date.now()}-${safeFileName(params.fileName)}`;
  await writeFile(path.join(dir, filename), params.bytes);
  return `${folder}/${filename}`;
}

/** Path absolut aman (tidak bisa keluar dari root). */
export function resolveKolUploadPath(storagePath: string): string {
  const root = getKolUploadRoot();
  const normalized = path.normalize(/* turbopackIgnore: true */ storagePath).replace(/^([\\/])+/, "");
  const full = path.resolve(/* turbopackIgnore: true */ root, normalized);
  const rel = path.relative(root, full);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path file tidak valid.");
  }
  return full;
}

export async function kolFileExists(storagePath: string): Promise<boolean> {
  try {
    const full = resolveKolUploadPath(storagePath);
    await stat(/* turbopackIgnore: true */ full);
    return true;
  } catch {
    return false;
  }
}

export async function removeKolFileBestEffort(storagePath: string | null | undefined) {
  if (!storagePath) return;
  try {
    const full = resolveKolUploadPath(storagePath);
    await unlink(/* turbopackIgnore: true */ full);
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.warn("[kol-uploads] gagal hapus", storagePath, e);
    }
  }
}
