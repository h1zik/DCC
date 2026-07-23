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
   * - `puppeteer-core`, `@sparticuz/chromium`, `puppeteer`: binary Chromium
   *   & native binding untuk render PDF server-side (headless print).
   */
  serverExternalPackages: [
    "sharp",
    "fluent-ffmpeg",
    "puppeteer-core",
    "@sparticuz/chromium",
    "puppeteer",
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
    /**
     * Batas body untuk unggahan lampiran/dokumen/video. Diturunkan dari 500 MB
     * (mitigasi DoS memory/disk). Naikkan lagi hanya bila memang perlu file
     * lebih besar dari ini.
     */
    proxyClientMaxBodySize: "300mb",
    serverActions: {
      bodySizeLimit: "300mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(self), microphone=(self), display-capture=(self), geolocation=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

export default nextConfig;
