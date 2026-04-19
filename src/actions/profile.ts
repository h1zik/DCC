"use server";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const basicsSchema = z.object({
  name: z.string().max(120).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
});

export async function updateProfileBasics(input: {
  name?: string | null;
  bio?: string | null;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");
  const data = basicsSchema.parse({
    name: input.name?.trim() ? input.name.trim() : null,
    bio: input.bio?.trim() ? input.bio.trim() : null,
  });
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: data.name,
      bio: data.bio,
    },
  });
  revalidatePath("/profile");
}

const AVATAR_MAX = 2 * 1024 * 1024;
const AVATAR_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

export async function updateProfileAvatar(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");

  const file = formData.get("avatar");
  if (!file || !(file instanceof File) || file.size === 0) {
    throw new Error("Pilih file gambar.");
  }
  if (file.size > AVATAR_MAX) {
    throw new Error("Ukuran foto maksimal 2 MB.");
  }
  const mime = file.type || "";
  if (!AVATAR_MIMES.includes(mime as (typeof AVATAR_MIMES)[number])) {
    throw new Error("Gunakan JPG, PNG, GIF, atau WebP.");
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { image: true },
  });
  if (me?.image?.startsWith("/uploads/avatars/")) {
    try {
      const segs = me.image.split("/").filter(Boolean);
      await unlink(path.join(process.cwd(), "public", ...segs));
    } catch {
      /* */
    }
  }

  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/gif"
        ? "gif"
        : mime === "image/webp"
          ? "webp"
          : "jpg";
  const stored = `${randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "avatars", session.user.id);
  await mkdir(dir, { recursive: true });
  const abs = path.join(dir, stored);
  await writeFile(abs, Buffer.from(await file.arrayBuffer()));

  const publicPath = `/uploads/avatars/${session.user.id}/${stored}`;
  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: publicPath },
  });
  revalidatePath("/profile");
  return { image: publicPath };
}

export async function clearProfileAvatar() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { image: true },
  });
  if (me?.image?.startsWith("/uploads/avatars/")) {
    try {
      const segs = me.image.split("/").filter(Boolean);
      await unlink(path.join(process.cwd(), "public", ...segs));
    } catch {
      /* */
    }
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: null },
  });
  revalidatePath("/profile");
}
