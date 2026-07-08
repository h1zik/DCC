import { prisma } from "@/lib/prisma";

/**
 * Feature flag gamifikasi profil. Sumber:
 *  1. Env `PROFILE_GAMIFICATION_ENABLED` = override darurat ("true"/"false").
 *  2. Bila env tak diset → toggle admin di DB (`AppBranding.profileGamificationEnabled`).
 *
 * Default OFF. Async (baca DB) — aman dipanggil di RSC, server action, route
 * handler, maupun script. Overhead = satu lookup singleton (diabaikan; jarang
 * dipanggil per request).
 */
function envOverride(): boolean | null {
  const raw = process.env.PROFILE_GAMIFICATION_ENABLED?.trim().toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return null;
}

export async function isProfileGamificationEnabled(): Promise<boolean> {
  const override = envOverride();
  if (override !== null) return override;
  try {
    const branding = await prisma.appBranding.findFirst({
      select: { profileGamificationEnabled: true },
    });
    return branding?.profileGamificationEnabled ?? false;
  } catch {
    return false; // fail-closed
  }
}
