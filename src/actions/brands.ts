"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdministrator } from "@/lib/auth-helpers";
import {
  absolutePathFromStoredPublicPath,
  getUploadPublicDir,
} from "@/lib/upload-storage";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";

const brandSchema = z.object({
  name: z.string().min(1),
  colorCode: z.string().optional().nullable(),
});

function revalidateBrandPaths() {
  revalidatePath("/brands");
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/inventory");
}

function sanitizeBaseName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "image";
}

async function removeLogoIfOwned(publicPath: string | null, brandId: string) {
  if (!publicPath) return;
  if (!publicPath.startsWith(`/uploads/brands/${brandId}/`)) return;
  const abs = absolutePathFromStoredPublicPath(publicPath);
  if (!abs) return;
  try {
    await unlink(abs);
  } catch {
    /* file mungkin sudah tidak ada */
  }
}

export async function createBrand(input: z.infer<typeof brandSchema>) {
  await requireAdministrator();
  const data = brandSchema.parse(input);
  const created = await prisma.brand.create({ data });
  revalidateBrandPaths();
  return { id: created.id };
}

export async function updateBrand(
  id: string,
  input: z.infer<typeof brandSchema>,
) {
  await requireAdministrator();
  const data = brandSchema.parse(input);
  await prisma.brand.update({ where: { id }, data });
  revalidateBrandPaths();
}

export async function uploadBrandLogo(brandId: string, formData: FormData) {
  await requireAdministrator();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw new Error("Pilih file logo terlebih dahulu.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`);
  }
  const mime = (file.type || "application/octet-stream").toLowerCase();
  if (!mime.startsWith("image/")) {
    throw new Error("Logo harus berupa file gambar.");
  }

  const brand = await prisma.brand.findUniqueOrThrow({
    where: { id: brandId },
    select: { logo: true },
  });

  const ext = path.extname(file.name).slice(0, 10).toLowerCase() || ".png";
  const base = sanitizeBaseName(path.basename(file.name, path.extname(file.name)));
  const stored = `${randomUUID()}-${base}${ext}`;
  const dir = path.join(getUploadPublicDir(), "brands", brandId, "logos");
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, stored), buf);
  const nextPublicPath = `/uploads/brands/${brandId}/logos/${stored}`;

  await prisma.brand.update({
    where: { id: brandId },
    data: { logo: nextPublicPath },
  });
  await removeLogoIfOwned(brand.logo, brandId);

  revalidateBrandPaths();
}

export async function clearBrandLogo(brandId: string) {
  await requireAdministrator();
  const brand = await prisma.brand.findUniqueOrThrow({
    where: { id: brandId },
    select: { logo: true },
  });
  await prisma.brand.update({
    where: { id: brandId },
    data: { logo: null },
  });
  await removeLogoIfOwned(brand.logo, brandId);
  revalidateBrandPaths();
}

export async function deleteBrand(id: string) {
  await requireAdministrator();
  const brand = await prisma.brand.findUniqueOrThrow({
    where: { id },
    select: { logo: true },
  });
  await prisma.brand.delete({ where: { id } });
  await removeLogoIfOwned(brand.logo, id);
  revalidateBrandPaths();
}
