"use server";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdministrator } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  absolutePathFromStoredPublicPath,
  getUploadPublicDir,
} from "@/lib/upload-storage";

const BRANDING_ID = "default";

async function removeIfOwned(publicPath: string | null) {
  if (!publicPath || !publicPath.startsWith("/uploads/branding/")) return;
  const abs = absolutePathFromStoredPublicPath(publicPath);
  if (!abs) return;
  try {
    await unlink(abs);
  } catch {
    // ignore
  }
}

function sanitizeBaseName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export async function updateAppBranding(formData: FormData) {
  await requireAdministrator();

  const appNameRaw = formData.get("appName");
  const navTitleRaw = formData.get("navTitle");
  const navSubtitleRaw = formData.get("navSubtitle");
  const logoFile = formData.get("logoFile");
  const faviconFile = formData.get("faviconFile");

  const appName =
    typeof appNameRaw === "string" && appNameRaw.trim()
      ? appNameRaw.trim().slice(0, 120)
      : "Dominatus Control Center";
  const navTitle =
    typeof navTitleRaw === "string" && navTitleRaw.trim()
      ? navTitleRaw.trim().slice(0, 50)
      : "Dominatus";
  const navSubtitle =
    typeof navSubtitleRaw === "string" && navSubtitleRaw.trim()
      ? navSubtitleRaw.trim().slice(0, 70)
      : "Control Center";

  const current = await prisma.appBranding.upsert({
    where: { id: BRANDING_ID },
    update: {},
    create: { id: BRANDING_ID },
    select: { logoImagePath: true, faviconPath: true },
  });

  let nextLogoPath = current.logoImagePath;
  let nextFaviconPath = current.faviconPath;

  const brandingDir = path.join(getUploadPublicDir(), "branding");
  await mkdir(brandingDir, { recursive: true });

  if (logoFile instanceof File && logoFile.size > 0) {
    const ext = path.extname(logoFile.name || "").toLowerCase() || ".png";
    const stored = `${randomUUID()}-${sanitizeBaseName(`logo${ext}`)}`;
    const absFile = path.join(brandingDir, stored);
    await writeFile(absFile, Buffer.from(await logoFile.arrayBuffer()));
    nextLogoPath = `/uploads/branding/${stored}`;
    await removeIfOwned(current.logoImagePath);
  }

  if (faviconFile instanceof File && faviconFile.size > 0) {
    const ext = path.extname(faviconFile.name || "").toLowerCase() || ".ico";
    const stored = `${randomUUID()}-${sanitizeBaseName(`favicon${ext}`)}`;
    const absFile = path.join(brandingDir, stored);
    await writeFile(absFile, Buffer.from(await faviconFile.arrayBuffer()));
    nextFaviconPath = `/uploads/branding/${stored}`;
    await removeIfOwned(current.faviconPath);
  }

  await prisma.appBranding.update({
    where: { id: BRANDING_ID },
    data: {
      appName,
      navTitle,
      navSubtitle,
      logoImagePath: nextLogoPath,
      faviconPath: nextFaviconPath,
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/branding");
}
