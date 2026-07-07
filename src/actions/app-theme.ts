"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { appThemeSchema, resolveAppThemePreset } from "@/lib/app-themes";
import { themeLibrarySchema, type ThemeLibrary } from "@/lib/theme-generator";
import { prisma } from "@/lib/prisma";

export async function updateAppTheme(
  preset: string,
  library?: ThemeLibrary | null,
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");

  const resolved = resolveAppThemePreset(appThemeSchema.parse(preset));

  // Library selalu ikut disimpan bila dikirim, agar tema tersimpan tetap awet
  // walau preset aktif sedang tema bawaan.
  const data: Prisma.UserUpdateInput = { appThemePreset: resolved };
  if (library != null) {
    data.appThemeCustom = themeLibrarySchema.parse(
      library,
    ) as Prisma.InputJsonValue;
  }

  await prisma.user.update({ where: { id: session.user.id }, data });

  revalidatePath("/", "layout");
  revalidatePath("/profile");
}

export async function getUserAppThemePreset(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { appThemePreset: true },
  });
  return user?.appThemePreset ?? "original";
}
