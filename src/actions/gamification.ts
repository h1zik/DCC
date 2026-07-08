"use server";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProfileGamificationEnabled } from "@/lib/gamification";
import {
  canEquipCosmetic,
  COSMETIC_SLOT_TYPE,
} from "@/lib/gamification/equip-rules";
import { normalizeProfileAccentHex } from "@/lib/profile-appearance";
import {
  absolutePathFromStoredPublicPath,
  getUploadPublicDir,
} from "@/lib/upload-storage";

async function requireGamification(): Promise<{ userId: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");
  if (!(await isProfileGamificationEnabled())) {
    throw new Error("Fitur gamifikasi profil sedang tidak aktif.");
  }
  return { userId: session.user.id };
}

/* ── updateProfileConfig ──────────────────────────────────────────────────── */

const updateSchema = z.object({
  equippedBackgroundId: z.string().nullable().optional(),
  equippedBorderId: z.string().nullable().optional(),
  equippedNameplateId: z.string().nullable().optional(),
  equippedTitleId: z.string().nullable().optional(),
  accentColor: z.string().nullable().optional(),
  customBorderColor: z.string().nullable().optional(),
  showcaseAchievementIds: z.array(z.string()).max(12).optional(),
});

const EQUIP_SLOTS = [
  "equippedBackgroundId",
  "equippedBorderId",
  "equippedNameplateId",
  "equippedTitleId",
] as const;

export async function updateProfileConfig(input: unknown) {
  const { userId } = await requireGamification();
  const parsed = updateSchema.parse(input);

  const idsToCheck = EQUIP_SLOTS.map((k) => parsed[k]).filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );

  const [progression, owned, items] = await Promise.all([
    prisma.userProgression.findUnique({ where: { userId } }),
    prisma.userCosmetic.findMany({
      where: { userId },
      select: { cosmeticItemId: true },
    }),
    idsToCheck.length
      ? prisma.cosmeticItem.findMany({ where: { id: { in: idsToCheck } } })
      : Promise.resolve([]),
  ]);
  const level = progression?.level ?? 1;
  const ownedIds = new Set(owned.map((o) => o.cosmeticItemId));
  const itemById = new Map(items.map((i) => [i.id, i]));

  const data: {
    equippedBackgroundId?: string | null;
    equippedBorderId?: string | null;
    equippedNameplateId?: string | null;
    equippedTitleId?: string | null;
    accentColor?: string | null;
    customBorderColor?: string | null;
    showcaseAchievementIds?: string[];
  } = {};

  for (const slot of EQUIP_SLOTS) {
    const val = parsed[slot];
    if (val === undefined) continue;
    if (val === null || val === "") {
      data[slot] = null;
      continue;
    }
    const item = itemById.get(val);
    if (!item) throw new Error("Item kosmetik tidak ditemukan.");
    const check = canEquipCosmetic(item, {
      slotType: COSMETIC_SLOT_TYPE[slot],
      level,
      ownedIds,
    });
    if (!check.ok) {
      throw new Error(check.reason ?? "Tidak bisa memasang item ini.");
    }
    data[slot] = val;
  }

  if (parsed.accentColor !== undefined) {
    data.accentColor = parsed.accentColor
      ? normalizeProfileAccentHex(parsed.accentColor)
      : null;
  }
  if (parsed.customBorderColor !== undefined) {
    data.customBorderColor = parsed.customBorderColor
      ? normalizeProfileAccentHex(parsed.customBorderColor)
      : null;
  }

  if (parsed.showcaseAchievementIds !== undefined) {
    const ids = parsed.showcaseAchievementIds;
    if (ids.length > 0) {
      const unlocked = await prisma.userAchievement.findMany({
        where: { userId, achievementId: { in: ids }, unlockedAt: { not: null } },
        select: { achievementId: true },
      });
      const unlockedSet = new Set(unlocked.map((u) => u.achievementId));
      if (ids.some((id) => !unlockedSet.has(id))) {
        throw new Error("Sebagian achievement showcase belum kamu buka.");
      }
    }
    data.showcaseAchievementIds = ids;
  }

  await prisma.userProfileConfig.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  revalidatePath("/profile");
  revalidatePath(`/profile/${userId}`);
  revalidatePath("/profile/edit");
}

/* ── uploadCustomBackground ───────────────────────────────────────────────── */

const BG_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;
const BG_MAX_BYTES = 8 * 1024 * 1024; // 8 MB (di-re-encode jadi webp)
const BG_MAX_W = 1600;
const BG_MAX_H = 900;
const BG_MIN_LEVEL = 2; // gate anti-spam ringan

export async function uploadCustomBackground(formData: FormData) {
  const { userId } = await requireGamification();

  const file = formData.get("background");
  if (!file || !(file instanceof File) || file.size === 0) {
    throw new Error("Pilih file gambar.");
  }
  if (file.size > BG_MAX_BYTES) throw new Error("Ukuran gambar maksimal 8 MB.");
  if (!BG_MIMES.includes(file.type as (typeof BG_MIMES)[number])) {
    throw new Error("Gunakan PNG, JPG, atau WebP.");
  }

  const progression = await prisma.userProgression.findUnique({
    where: { userId },
  });
  if ((progression?.level ?? 1) < BG_MIN_LEVEL) {
    throw new Error(`Upload latar terbuka di Level ${BG_MIN_LEVEL}.`);
  }

  // Re-encode server-side: .rotate() menormalkan + STRIP EXIF, resize batasi dimensi.
  const inputBuffer = Buffer.from(await file.arrayBuffer());
  let webp: Buffer;
  try {
    webp = await sharp(inputBuffer)
      .rotate()
      .resize({
        width: BG_MAX_W,
        height: BG_MAX_H,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
  } catch {
    throw new Error("Gambar tidak valid atau rusak.");
  }

  const stored = `${randomUUID()}.webp`;
  const dir = path.join(getUploadPublicDir(), "profile-bg", userId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, stored), webp);
  const publicPath = `/uploads/profile-bg/${userId}/${stored}`;

  // Hapus file lama (bila milik path aman).
  const prev = await prisma.userProfileConfig.findUnique({
    where: { userId },
    select: { customBackgroundUrl: true },
  });
  if (prev?.customBackgroundUrl?.startsWith("/uploads/profile-bg/")) {
    const oldAbs = absolutePathFromStoredPublicPath(prev.customBackgroundUrl);
    if (oldAbs) await unlink(oldAbs).catch(() => {});
  }

  // Simpan URL + auto-equip slot upload (bila ada di katalog).
  const uploadSlot = await prisma.cosmeticItem.findUnique({
    where: { key: "bg-upload-slot" },
    select: { id: true },
  });
  await prisma.userProfileConfig.upsert({
    where: { userId },
    create: {
      userId,
      customBackgroundUrl: publicPath,
      equippedBackgroundId: uploadSlot?.id ?? null,
    },
    update: {
      customBackgroundUrl: publicPath,
      ...(uploadSlot ? { equippedBackgroundId: uploadSlot.id } : {}),
    },
  });

  revalidatePath("/profile");
  revalidatePath(`/profile/${userId}`);
  revalidatePath("/profile/edit");
  return { customBackgroundUrl: publicPath };
}

export async function clearCustomBackground() {
  const { userId } = await requireGamification();
  const config = await prisma.userProfileConfig.findUnique({
    where: { userId },
    select: { customBackgroundUrl: true, equippedBackgroundId: true },
  });
  if (config?.customBackgroundUrl?.startsWith("/uploads/profile-bg/")) {
    const abs = absolutePathFromStoredPublicPath(config.customBackgroundUrl);
    if (abs) await unlink(abs).catch(() => {});
  }
  // Jika slot upload sedang ter-equip, lepas (fallback ke preset lama).
  const uploadSlot = await prisma.cosmeticItem.findUnique({
    where: { key: "bg-upload-slot" },
    select: { id: true },
  });
  await prisma.userProfileConfig.update({
    where: { userId },
    data: {
      customBackgroundUrl: null,
      ...(config?.equippedBackgroundId &&
      config.equippedBackgroundId === uploadSlot?.id
        ? { equippedBackgroundId: null }
        : {}),
    },
  });
  revalidatePath("/profile");
  revalidatePath(`/profile/${userId}`);
  revalidatePath("/profile/edit");
}
