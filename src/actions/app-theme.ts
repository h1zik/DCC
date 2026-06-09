"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { appThemeSchema, resolveAppThemePreset } from "@/lib/app-themes";
import { prisma } from "@/lib/prisma";

export async function updateAppTheme(preset: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");

  const parsed = appThemeSchema.parse(preset);
  const resolved = resolveAppThemePreset(parsed);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { appThemePreset: resolved },
  });

  revalidatePath("/", "layout");
  revalidatePath("/profile");
}

export async function getUserAppThemePreset(
  userId: string,
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { appThemePreset: true },
  });
  return user?.appThemePreset ?? "original";
}
