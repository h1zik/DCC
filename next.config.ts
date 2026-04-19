import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /** Unggah lampiran / dokumen besar (batas di app tidak lagi dipotong di 10–25 MB). */
      bodySizeLimit: "500mb",
    },
  },
};

export default nextConfig;
