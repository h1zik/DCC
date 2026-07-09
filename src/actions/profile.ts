"use server";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  absolutePathFromStoredPublicPath,
  getUploadPublicDir,
} from "@/lib/upload-storage";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  normalizeProfileAccentHex,
  normalizeProfileSticker,
  profileAppearanceSchema,
} from "@/lib/profile-appearance";
import { prisma } from "@/lib/prisma";

const basicsSchema = z.object({
  name: z.string().max(120).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
});

const E164 = /^\+[1-9]\d{6,14}$/;

export async function updateProfileBasics(input: {
  name?: string | null;
  bio?: string | null;
  whatsappPhone?: string | null;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");
  const data = basicsSchema.parse({
    name: input.name?.trim() ? input.name.trim() : null,
    bio: input.bio?.trim() ? input.bio.trim() : null,
  });

  let whatsappPhone: string | null | undefined;
  if (input.whatsappPhone !== undefined) {
    const t = (input.whatsappPhone ?? "").trim();
    if (t === "") whatsappPhone = null;
    else if (!E164.test(t)) {
      throw new Error(
        "Nomor WhatsApp pakai format E.164 (contoh +6281234567890).",
      );
    } else whatsappPhone = t;
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: data.name,
      bio: data.bio,
      ...(whatsappPhone !== undefined ? { whatsappPhone } : {}),
    },
  });
  revalidatePath("/profile");
}

/**
 * Update kontak (WhatsApp) tersendiri — dipakai bagian "Akun & keamanan" agar
 * menyimpan nomor tidak ikut menimpa nama/bio (yang disimpan di bagian Profil).
 */
export async function updateProfileContact(input: {
  whatsappPhone?: string | null;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");

  const t = (input.whatsappPhone ?? "").trim();
  let whatsappPhone: string | null;
  if (t === "") whatsappPhone = null;
  else if (!E164.test(t)) {
    throw new Error(
      "Nomor WhatsApp pakai format E.164 (contoh +6281234567890).",
    );
  } else whatsappPhone = t;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { whatsappPhone },
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
      const oldAbs = absolutePathFromStoredPublicPath(me.image);
      if (oldAbs) await unlink(oldAbs);
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
  const dir = path.join(getUploadPublicDir(), "avatars", session.user.id);
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

export async function updateProfileAppearance(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");

  const parsed = profileAppearanceSchema.parse(input);
  const taglineRaw = (parsed.profileTagline ?? "").trim();
  const tagline = taglineRaw ? taglineRaw.slice(0, 160) : null;
  const accent = normalizeProfileAccentHex(parsed.profileAccentHex ?? null);
  const sticker = normalizeProfileSticker(parsed.profileSticker ?? null);

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      profileBannerPreset: parsed.profileBannerPreset,
      profileTagline: tagline,
      profileAccentHex: accent,
      profileBannerPattern: parsed.profileBannerPattern,
      profileSticker: sticker,
      profileAvatarFrame: parsed.profileAvatarFrame,
    },
  });

  revalidatePath("/profile");
  revalidatePath(`/profile/${session.user.id}`);
}

const taglineStickerSchema = z.object({
  tagline: z.string().max(160).optional().nullable(),
  sticker: z.string().max(24).optional().nullable(),
});

/**
 * Update ringan: hanya slogan + stiker (dipakai editor gamifikasi supaya studio
 * tampilan lama bisa disembunyikan tanpa kehilangan kontrol ini).
 */
export async function updateProfileTaglineSticker(
  input: z.infer<typeof taglineStickerSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");
  const parsed = taglineStickerSchema.parse(input);
  const taglineRaw = (parsed.tagline ?? "").trim();
  const tagline = taglineRaw ? taglineRaw.slice(0, 160) : null;
  const sticker = normalizeProfileSticker(parsed.sticker ?? null);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { profileTagline: tagline, profileSticker: sticker },
  });

  revalidatePath("/profile");
  revalidatePath(`/profile/${session.user.id}`);
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Masukkan kata sandi saat ini."),
  newPassword: z
    .string()
    .min(8, "Kata sandi baru minimal 8 karakter.")
    .max(128, "Kata sandi terlalu panjang."),
});

/** Ganti kata sandi akun sendiri — wajib memverifikasi kata sandi saat ini. */
export async function changeOwnPassword(
  input: z.infer<typeof changePasswordSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");
  const data = changePasswordSchema.parse(input);

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!me) throw new Error("Pengguna tidak ditemukan.");

  const ok = await bcrypt.compare(data.currentPassword, me.passwordHash);
  if (!ok) throw new Error("Kata sandi saat ini salah.");

  if (data.newPassword === data.currentPassword) {
    throw new Error("Kata sandi baru harus berbeda dari yang lama.");
  }

  const passwordHash = await bcrypt.hash(data.newPassword, 10);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  });
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
      const oldAbs = absolutePathFromStoredPublicPath(me.image);
      if (oldAbs) await unlink(oldAbs);
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
