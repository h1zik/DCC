import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Paket berikut harus di-resolve oleh Node saat runtime, BUKAN di-bundle
   * oleh Turbopack/webpack:
   * - `sharp` & `fluent-ffmpeg`: bergantung pada native binding/binary
   * - `ffmpeg-static`, `@ffprobe-installer/ffprobe`: berisi binary `.exe`
   *   yang Turbopack tidak tahu cara handle (error "Unknown module type").
   * - `@ffprobe-installer/<platform>-<arch>`: sub-package per OS yang
   *   di-`require()` secara dinamis.
   */
  serverExternalPackages: [
    "sharp",
    "fluent-ffmpeg",
    "ffmpeg-static",
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
