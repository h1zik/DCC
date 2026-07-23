import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/** Id singleton baris AppBranding (satu-satunya baris pengaturan aplikasi). */
export const BRANDING_ID = "default";

/**
 * Tag cache branding — panggil `revalidateTag(BRANDING_CACHE_TAG)` setiap
 * kali kolom branding di baris AppBranding ditulis.
 */
export const BRANDING_CACHE_TAG = "app-branding";

const BRANDING_SELECT = {
  appName: true,
  navTitle: true,
  navSubtitle: true,
  logoImagePath: true,
  faviconPath: true,
  pushIconPath: true,
} as const;

/** Default statis saat baris singleton belum pernah dibuat (selaras @default schema). */
const BRANDING_DEFAULTS = {
  appName: "Dominatus Control Center",
  navTitle: "Dominatus",
  navSubtitle: "Control Center",
  logoImagePath: null as string | null,
  faviconPath: null as string | null,
  pushIconPath: null as string | null,
};

/**
 * Baca branding TANPA menulis DB — di-cache lintas request (dipanggil dari
 * root layout pada setiap render). Baris singleton dibuat lazily oleh jalur
 * tulis via `ensureAppBrandingRow`; sebelum ada, kembalikan default statis.
 */
export const getAppBranding = unstable_cache(
  async () => {
    const row = await prisma.appBranding.findUnique({
      where: { id: BRANDING_ID },
      select: BRANDING_SELECT,
    });
    return row ?? BRANDING_DEFAULTS;
  },
  ["app-branding"],
  { tags: [BRANDING_CACHE_TAG], revalidate: 3600 },
);

/**
 * Pastikan baris singleton ada. Hanya untuk jalur tulis (admin/seed) —
 * jangan panggil dari render path.
 */
export async function ensureAppBrandingRow() {
  return prisma.appBranding.upsert({
    where: { id: BRANDING_ID },
    update: {},
    create: { id: BRANDING_ID },
    select: BRANDING_SELECT,
  });
}
