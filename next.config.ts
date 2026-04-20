import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
