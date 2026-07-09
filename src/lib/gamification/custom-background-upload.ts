/**
 * Validasi & deteksi unggahan latar profil kustom (gambar / Lottie / video).
 * User tidak boleh menyuplai JS/SVG-berscript — hanya format aman ini.
 */
import type { CosmeticAssetMedia } from "./cosmetic-assets";

export const CUSTOM_BG_IMAGE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const CUSTOM_BG_VIDEO_MIMES = ["video/mp4"] as const;

export const CUSTOM_BG_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const CUSTOM_BG_MAX_LOTTIE_JSON_BYTES = 5 * 1024 * 1024;
export const CUSTOM_BG_MAX_DOTLOTTIE_BYTES = 8 * 1024 * 1024;
export const CUSTOM_BG_MAX_VIDEO_BYTES = 15 * 1024 * 1024;

export type CustomBackgroundUploadKind =
  | "image"
  | "lottie-json"
  | "lottie-dot"
  | "video-mp4";

/** Deteksi jenis unggahan dari MIME + ekstensi file. */
export function detectCustomBackgroundKind(file: File): CustomBackgroundUploadKind {
  const name = file.name.toLowerCase();
  if (name.endsWith(".mp4")) return "video-mp4";
  if (name.endsWith(".lottie")) return "lottie-dot";
  if (name.endsWith(".json")) return "lottie-json";
  if (
    CUSTOM_BG_IMAGE_MIMES.includes(
      file.type as (typeof CUSTOM_BG_IMAGE_MIMES)[number],
    )
  ) {
    return "image";
  }
  if (
    CUSTOM_BG_VIDEO_MIMES.includes(
      file.type as (typeof CUSTOM_BG_VIDEO_MIMES)[number],
    )
  ) {
    return "video-mp4";
  }
  if (file.type === "application/json") return "lottie-json";
  throw new Error(
    "Gunakan PNG/JPG/WebP, MP4, Lottie JSON (.json), atau dotLottie (.lottie).",
  );
}

/** Validasi body Lottie JSON; return objek ternormalisasi untuk ditulis ulang. */
export function validateLottieJson(raw: Buffer): Record<string, unknown> {
  if (raw.length > CUSTOM_BG_MAX_LOTTIE_JSON_BYTES) {
    throw new Error("Lottie JSON maksimal 5 MB.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new Error("File JSON tidak valid.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Format Lottie tidak dikenali.");
  }
  const body = parsed as Record<string, unknown>;
  const hasLayers = Array.isArray(body.layers);
  const hasAssets = Array.isArray(body.assets);
  if (!hasLayers && !hasAssets) {
    throw new Error("File bukan animasi Lottie yang valid.");
  }
  return body;
}

/** Validasi header ZIP untuk dotLottie (.lottie). */
export function validateDotLottie(raw: Buffer): void {
  if (raw.length > CUSTOM_BG_MAX_DOTLOTTIE_BYTES) {
    throw new Error("dotLottie maksimal 8 MB.");
  }
  if (raw.length < 4 || raw[0] !== 0x50 || raw[1] !== 0x4b) {
    throw new Error("File .lottie tidak valid.");
  }
}

/** Validasi container MP4 (ISO BMFF `ftyp` box). */
export function validateMp4(raw: Buffer): void {
  if (raw.length > CUSTOM_BG_MAX_VIDEO_BYTES) {
    throw new Error("MP4 maksimal 15 MB.");
  }
  if (raw.length < 12) {
    throw new Error("File MP4 tidak valid.");
  }
  const ftyp = raw.subarray(4, 8).toString("ascii");
  if (ftyp !== "ftyp") {
    throw new Error("File MP4 tidak valid.");
  }
}

export function mediaForUploadKind(
  kind: CustomBackgroundUploadKind,
): CosmeticAssetMedia {
  if (kind === "image") return "image";
  if (kind === "video-mp4") return "video";
  return "lottie";
}

/** Turunkan media dari URL tersimpan (backfill bila kolom media kosong). */
export function inferCustomBackgroundMedia(
  url: string,
  stored: string | null | undefined,
): CosmeticAssetMedia {
  if (stored === "lottie" || stored === "image" || stored === "video") {
    return stored;
  }
  const lower = url.toLowerCase();
  if (lower.endsWith(".json") || lower.endsWith(".lottie")) return "lottie";
  if (lower.endsWith(".mp4") || lower.endsWith(".webm")) return "video";
  return "image";
}

export function storedExtensionForKind(kind: CustomBackgroundUploadKind): string {
  if (kind === "image") return "webp";
  if (kind === "video-mp4") return "mp4";
  if (kind === "lottie-json") return "json";
  return "lottie";
}

/** Label UI untuk jenis unggahan tersimpan. */
export function customBackgroundMediaLabel(
  url: string,
  media: string | null | undefined,
): "Gambar" | "Lottie" | "Video" {
  const resolved = inferCustomBackgroundMedia(url, media);
  if (resolved === "lottie") return "Lottie";
  if (resolved === "video") return "Video";
  return "Gambar";
}
