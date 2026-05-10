/**
 * Generator thumbnail untuk dokumen ruangan (gambar + video).
 *
 * Modul ini SENGAJA tidak meng-`import "server-only"` agar bisa dipakai dari
 * script Node biasa (mis. backfill `scripts/backfill-document-thumbnails.ts`).
 * Helper di sini hanya menyentuh filesystem + sharp + ffmpeg — tidak ada I/O
 * database. Konsumer (server action / API route / script) yang bertanggung
 * jawab atas konteks-nya masing-masing.
 */

import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";

/**
 * Set lokasi biner sekali saat modul di-load.
 *
 * - Kita pakai `@ffmpeg-installer/ffmpeg` + `@ffprobe-installer/ffprobe`
 *   ALIH-ALIH `ffmpeg-static`. Alasan: `ffmpeg-static` mengunduh biner ~75 MB
 *   dari satu CDN via postinstall script — di builder cloud (Railway, Vercel,
 *   dst.) langkah ini sering hang sampai 10+ menit. Paket `@ffmpeg-installer`
 *   versi yang sama tapi mengirim biner sebagai paket npm per-platform —
 *   download mengalir lewat registry npm yang cepat & ter-cache.
 * - `fluent-ffmpeg.screenshots()` di belakang layar memanggil ffprobe untuk
 *   mengetahui durasi video (perlu untuk seek `"50%"`). Tanpa ffprobe muncul
 *   error "Cannot find ffprobe" yang dulu tertelan diam-diam.
 *
 * Bila salah satu biner tidak tersedia (lingkungan eksotis), thumbnail video
 * di-skip — fallback ke ikon/gradient di UI.
 */
const FFMPEG_PATH: string | null = ffmpegInstaller?.path ?? null;
const FFPROBE_PATH: string | null = ffprobeInstaller?.path ?? null;
if (FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(FFMPEG_PATH);
}
if (FFPROBE_PATH) {
  ffmpeg.setFfprobePath(FFPROBE_PATH);
}

/**
 * Sumber gambar yang aman/cepat di-decode oleh `sharp`. Kita tidak coba
 * thumbnail untuk SVG (XML, dipakai inline biasanya kecil) dan format eksotis.
 */
export function shouldGenerateImageThumbnail(mime: string): boolean {
  if (!mime.startsWith("image/")) return false;
  const lower = mime.toLowerCase();
  if (lower === "image/svg+xml" || lower === "image/svg") return false;
  if (lower === "image/x-icon" || lower === "image/vnd.microsoft.icon") {
    return false;
  }
  return true;
}

/**
 * Hampir semua kontainer video umum bisa di-demux + dekode oleh ffmpeg-static
 * (mp4/mov/webm/mkv/avi). Audio file mime-nya `audio/...` jadi tidak ikut.
 */
export function shouldGenerateVideoThumbnail(mime: string): boolean {
  if (!FFMPEG_PATH || !FFPROBE_PATH) return false;
  return mime.toLowerCase().startsWith("video/");
}

export const THUMBNAIL_MAX_DIMENSION = 480;
export const THUMBNAIL_QUALITY = 72;

/**
 * Batas ukuran sumber gambar yang masih kita coba thumbnail. Gambar raksasa
 * (≥80 MB) di-skip — `sharp` tetap bisa, tapi cost CPU + RAM dekoding lebih
 * tinggi daripada manfaatnya untuk thumbnail satu kali.
 */
export const THUMBNAIL_MAX_IMAGE_SOURCE_BYTES = 80 * 1024 * 1024;

/**
 * Untuk video, ffmpeg pakai input-side seek (-ss sebelum -i) lewat demuxer
 * index — biaya hampir konstan terhadap durasi/ukuran. Tetap kita batasi pada
 * 5 GB sebagai safety net (di luar itu kemungkinan bukan video biasa).
 */
export const THUMBNAIL_MAX_VIDEO_SOURCE_BYTES = 5 * 1024 * 1024 * 1024;

/**
 * Ekstrak satu frame video ke file webp. Jalur:
 *   1. ffmpeg → frame JPEG temporer (di OS tmpdir, di luar `public/`)
 *   2. `sharp` baca JPEG, resize + encode WebP final
 *   3. JPEG temp dihapus di blok finally
 *
 * Output ffmpeg ke JPEG (universal di semua build) lalu sharp urus WebP — ini
 * membuat kita tidak bergantung pada libwebp encoder ffmpeg yang tidak selalu
 * disertakan oleh build statis Windows.
 */
async function extractVideoFrameWebp(args: {
  absSourceFile: string;
  absThumbOut: string;
}): Promise<boolean> {
  const tempJpg = path.join(os.tmpdir(), `dcc-vid-${randomUUID()}.jpg`);
  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(args.absSourceFile)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .screenshots({
          // 50% durasi biasanya lewat title card / fade-in dan masih punya
          // konten yang bermakna. Untuk klip pendek, ffmpeg fallback ke
          // frame valid terdekat — lebih robust daripada `["1"]`.
          timestamps: ["50%"],
          filename: path.basename(tempJpg),
          folder: path.dirname(tempJpg),
          // 960px lebih besar dari final 480 — sharp menentukan ukuran akhir
          // + kualitas WebP. Lebih besar di tahap ini melindungi ketajaman
          // bila aspect rationya tinggi (mis. video vertikal 9:16).
          size: "960x?",
        });
    });

    await sharp(tempJpg)
      .rotate()
      .resize({
        width: THUMBNAIL_MAX_DIMENSION,
        height: THUMBNAIL_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: THUMBNAIL_QUALITY, effort: 4 })
      .toFile(args.absThumbOut);
    return true;
  } catch (err) {
    // Logging eksplisit — sebelumnya error tertelan diam-diam dan kita
    // kehilangan visibilitas terhadap codec yang gagal / file korup.
    console.warn(
      `[thumbnail] ffmpeg/video gagal untuk ${args.absSourceFile}:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  } finally {
    await unlink(tempJpg).catch(() => undefined);
  }
}

/**
 * Buat thumbnail webp di samping berkas asli (untuk image **dan** video).
 * Mengembalikan publicPath thumbnail-nya, atau null bila gagal/skip — fallback
 * aman ke `publicPath` (atau ikon tipe file di UI).
 */
export async function maybeGenerateThumbnail(args: {
  absSourceFile: string;
  absDir: string;
  storedBaseName: string;
  publicPathPrefix: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<string | null> {
  const isImage = shouldGenerateImageThumbnail(args.mimeType);
  const isVideo = shouldGenerateVideoThumbnail(args.mimeType);
  if (!isImage && !isVideo) return null;
  if (isImage && args.sizeBytes > THUMBNAIL_MAX_IMAGE_SOURCE_BYTES) {
    console.warn(
      `[thumbnail] ${args.absSourceFile} di-skip: ukuran ${args.sizeBytes} > batas image (${THUMBNAIL_MAX_IMAGE_SOURCE_BYTES})`,
    );
    return null;
  }
  if (isVideo && args.sizeBytes > THUMBNAIL_MAX_VIDEO_SOURCE_BYTES) {
    console.warn(
      `[thumbnail] ${args.absSourceFile} di-skip: ukuran ${args.sizeBytes} > batas video (${THUMBNAIL_MAX_VIDEO_SOURCE_BYTES})`,
    );
    return null;
  }

  const thumbName = `${args.storedBaseName}.thumb.webp`;
  const thumbAbs = path.join(args.absDir, thumbName);

  let ok = false;
  if (isImage) {
    try {
      await sharp(args.absSourceFile)
        .rotate()
        .resize({
          width: THUMBNAIL_MAX_DIMENSION,
          height: THUMBNAIL_MAX_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: THUMBNAIL_QUALITY, effort: 4 })
        .toFile(thumbAbs);
      ok = true;
    } catch (err) {
      console.warn(
        `[thumbnail] sharp/image gagal untuk ${args.absSourceFile}:`,
        err instanceof Error ? err.message : err,
      );
      ok = false;
    }
  } else {
    ok = await extractVideoFrameWebp({
      absSourceFile: args.absSourceFile,
      absThumbOut: thumbAbs,
    });
  }

  if (!ok) {
    await unlink(thumbAbs).catch(() => undefined);
    return null;
  }
  return `${args.publicPathPrefix}/${thumbName}`;
}

/**
 * Variant publik dari ekstraktor thumbnail — dipakai script backfill untuk
 * dokumen lama yang belum punya `thumbPath`. Mengembalikan publicPath
 * relatif (mis. `/uploads/rooms/<roomId>/<file>.thumb.webp`) atau null.
 */
export async function regenerateThumbnailForExistingFile(args: {
  /** Path absolut ke berkas asli di disk. */
  absSourceFile: string;
  /** Path public asli (mis. `/uploads/rooms/<roomId>/<file>`). */
  publicPath: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<string | null> {
  const absDir = path.dirname(args.absSourceFile);
  const storedBaseName = path.basename(args.absSourceFile);
  const publicPathPrefix = path.posix.dirname(args.publicPath);
  return maybeGenerateThumbnail({
    absSourceFile: args.absSourceFile,
    absDir,
    storedBaseName,
    publicPathPrefix,
    mimeType: args.mimeType,
    sizeBytes: args.sizeBytes,
  });
}
