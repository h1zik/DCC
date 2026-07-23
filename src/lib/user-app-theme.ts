import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/** Tag cache preferensi tema per user — revalidate saat `updateAppTheme`. */
export function userThemeTag(userId: string) {
  return `user-theme:${userId}`;
}

/**
 * Preferensi tema user, di-cache lintas request (root layout membacanya di
 * setiap render). Invalidasi via `revalidateTag(userThemeTag(userId))`.
 */
export function getUserAppTheme(userId: string) {
  return unstable_cache(
    () =>
      prisma.user.findUnique({
        where: { id: userId },
        select: { appThemePreset: true, appThemeCustom: true },
      }),
    ["user-app-theme", userId],
    { tags: [userThemeTag(userId)], revalidate: 300 },
  )();
}
