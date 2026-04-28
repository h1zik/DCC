import { prisma } from "@/lib/prisma";

const BRANDING_ID = "default";

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
    },
  });
}
