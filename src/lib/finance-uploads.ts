import "server-only";

import { createHash } from "node:crypto";
import { mkdir, rm, unlink, writeFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Direktori akar untuk menyimpan lampiran finance.
 * Bukan di `public/` agar file tidak dapat diakses tanpa autentikasi —
 * file di-stream oleh route handler `/api/finance/line-attachments/[id]`.
 */
export const FINANCE_UPLOAD_ROOT = path.resolve(
  process.cwd(),
  "uploads",
  "finance",
);

export const FINANCE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const FINANCE_ATTACHMENT_ALLOWED_MIME = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export type SavedAttachment = {
  /** Nama file pada disk, relatif terhadap FINANCE_UPLOAD_ROOT. */
  storagePath: string;
  /** SHA-256 hex isi file. */
  hash: string;
  size: number;
};

/** Bersihkan nama file agar aman dipakai sebagai path segment. */
export function safeFileName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "file";
  // izinkan huruf, angka, titik, dash, underscore; ganti sisanya dengan dash
  return base.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120) || "file";
}

/**
 * Simpan file ke `uploads/finance/<entryId>/<attachmentId>-<filename>`.
 * Mengembalikan storagePath relatif (entryId/filename) dan hash SHA-256.
 */
export async function saveFinanceAttachment(params: {
  entryId: string;
  attachmentId: string;
  fileName: string;
  bytes: Buffer | Uint8Array;
}): Promise<SavedAttachment> {
  const dir = path.join(FINANCE_UPLOAD_ROOT, params.entryId);
  await mkdir(dir, { recursive: true });

  const safe = safeFileName(params.fileName);
  const filename = `${params.attachmentId}-${safe}`;
  const fullPath = path.join(dir, filename);

  const buf = Buffer.isBuffer(params.bytes)
    ? params.bytes
    : Buffer.from(params.bytes);

  await writeFile(fullPath, buf);

  const hash = createHash("sha256").update(buf).digest("hex");
  const storagePath = path.posix.join(params.entryId, filename);

  return { storagePath, hash, size: buf.byteLength };
}

/** Hapus file fisik. Dianggap berhasil jika file sudah tidak ada. */
export async function removeFinanceAttachment(storagePath: string) {
  const full = path.join(FINANCE_UPLOAD_ROOT, storagePath);
  try {
    await unlink(full);
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return;
    throw e;
  }
}

/**
 * Hapus banyak file fisik best-effort — untuk jalur hapus draf/baris di mana
 * baris DB-nya lenyap via cascade tetapi filenya dulu tertinggal (yatim).
 * Kegagalan per-file dicatat, tidak menggagalkan operasi.
 */
export async function removeFinanceAttachmentsBestEffort(
  storagePaths: string[],
) {
  for (const p of storagePaths) {
    try {
      await removeFinanceAttachment(p);
    } catch (err) {
      console.warn(`[finance-uploads] gagal hapus file lampiran ${p}:`, err);
    }
  }
}

/** Hapus seluruh direktori lampiran finance (dipakai reset data demo). */
export async function removeAllFinanceAttachmentFiles() {
  await rm(FINANCE_UPLOAD_ROOT, { recursive: true, force: true });
}

/** Resolve absolute path (untuk route handler streaming). */
export function resolveFinanceAttachmentPath(storagePath: string): string {
  // Defense in depth: pastikan tidak keluar dari FINANCE_UPLOAD_ROOT.
  const normalized = path
    .normalize(storagePath)
    .replace(/^([\\/])+/, "");
  const full = path.resolve(FINANCE_UPLOAD_ROOT, normalized);
  const rel = path.relative(FINANCE_UPLOAD_ROOT, full);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path lampiran tidak valid.");
  }
  return full;
}

/** Cek apakah file masih ada di disk. */
export async function attachmentFileExists(storagePath: string): Promise<boolean> {
  try {
    const full = resolveFinanceAttachmentPath(storagePath);
    await stat(full);
    return true;
  } catch {
    return false;
  }
}
