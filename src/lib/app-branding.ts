import { prisma } from "@/lib/prisma";

/** Id singleton baris AppBranding (satu-satunya baris pengaturan aplikasi). */
export const BRANDING_ID = "default";

export async function getAppBranding() {
  return prisma.appBranding.upsert({
    where: { id: BRANDING_ID },
    update: {},
    create: { id: BRANDING_ID },
    select: {
      appName: true,
      navTitle: true,
      navSubtitle: true,
      logoImagePath: true,
      faviconPath: true,
      pushIconPath: true,
    },
  });
}
