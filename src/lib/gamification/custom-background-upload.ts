/**
 * Validasi & deteksi unggahan latar animasi (gambar / Lottie / video) yang
 * dipakai admin saat menambah background kosmetik di menu Gamifikasi. Hanya
 * format aman ini yang diterima — tak boleh ada JS/SVG-berscript.
 */
import type { CosmeticAssetMedia } from "./cosmetic-assets";

export const CUSTOM_BG_IMAGE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const CUSTOM_BG_VIDEO_MIMES = ["video/mp4"] as const;

export const CUSTOM_BG_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const CUSTOM_BG_MAX_IMAGE_BYTES = CUSTOM_BG_MAX_UPLOAD_BYTES;
export const CUSTOM_BG_MAX_LOTTIE_JSON_BYTES = CUSTOM_BG_MAX_UPLOAD_BYTES;
export const CUSTOM_BG_MAX_DOTLOTTIE_BYTES = CUSTOM_BG_MAX_UPLOAD_BYTES;
export const CUSTOM_BG_MAX_VIDEO_BYTES = CUSTOM_BG_MAX_UPLOAD_BYTES;

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
    throw new Error("Lottie JSON maksimal 20 MB.");
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
    throw new Error("dotLottie maksimal 20 MB.");
  }
  if (raw.length < 4 || raw[0] !== 0x50 || raw[1] !== 0x4b) {
    throw new Error("File .lottie tidak valid.");
  }
}

/** Validasi container MP4 (ISO BMFF `ftyp` box). */
export function validateMp4(raw: Buffer): void {
  if (raw.length > CUSTOM_BG_MAX_VIDEO_BYTES) {
    throw new Error("MP4 maksimal 20 MB.");
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

export function storedExtensionForKind(kind: CustomBackgroundUploadKind): string {
  if (kind === "image") return "webp";
  if (kind === "video-mp4") return "mp4";
  if (kind === "lottie-json") return "json";
  return "lottie";
}
