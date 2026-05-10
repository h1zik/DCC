import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Paket berikut harus di-resolve oleh Node saat runtime, BUKAN di-bundle
   * oleh Turbopack/webpack:
   * - `sharp` & `fluent-ffmpeg`: bergantung pada native binding/binary.
   * - `@ffmpeg-installer/ffmpeg`, `@ffprobe-installer/ffprobe`: berisi
   *   biner platform-specific (`ffmpeg.exe`, `ffprobe.exe`, dll.) yang
   *   Turbopack tidak tahu cara handle (error "Unknown module type").
   * - Sub-package `@ffmpeg-installer/<platform>-<arch>` &
   *   `@ffprobe-installer/<platform>-<arch>` di-`require()` secara dinamis
   *   oleh paket induknya — semua kombinasi OS/arch perlu diluar bundle.
   */
  serverExternalPackages: [
    "sharp",
    "fluent-ffmpeg",
    "@ffmpeg-installer/ffmpeg",
    "@ffmpeg-installer/darwin-arm64",
    "@ffmpeg-installer/darwin-x64",
    "@ffmpeg-installer/linux-arm",
    "@ffmpeg-installer/linux-arm64",
    "@ffmpeg-installer/linux-ia32",
    "@ffmpeg-installer/linux-x64",
    "@ffmpeg-installer/win32-ia32",
    "@ffmpeg-installer/win32-x64",
    "@ffprobe-installer/ffprobe",
    "@ffprobe-installer/darwin-arm64",
    "@ffprobe-installer/darwin-x64",
    "@ffprobe-installer/linux-arm",
    "@ffprobe-installer/linux-arm64",
    "@ffprobe-installer/linux-ia32",
    "@ffprobe-installer/linux-x64",
    "@ffprobe-installer/win32-ia32",
    "@ffprobe-installer/win32-x64",
  ],
  experimental: {
    /** Naikkan batas body yang dibaca proxy/middleware (default 10 MB). */
    proxyClientMaxBodySize: "500mb",
    serverActions: {
      /** Unggah lampiran / dokumen besar (batas di app tidak lagi dipotong di 10–25 MB). */
      bodySizeLimit: "500mb",
    },
  },
};

export default nextConfig;
