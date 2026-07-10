"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { z } from "zod";
import {
  CosmeticRarity,
  CosmeticUnlockType,
  type Prisma,
} from "@prisma/client";
import { auth } from "@/lib/auth";
import { requireCeoOrAdministrator } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { isProfileGamificationEnabled } from "@/lib/gamification";
import {
  canEquipCosmetic,
  COSMETIC_SLOT_TYPE,
} from "@/lib/gamification/equip-rules";
import { normalizeProfileAccentHex } from "@/lib/profile-appearance";
import {
  detectCustomBackgroundKind,
  mediaForUploadKind,
  storedExtensionForKind,
  validateDotLottie,
  validateLottieJson,
  validateMp4,
} from "@/lib/gamification/custom-background-upload";
import { getUploadPublicDir } from "@/lib/upload-storage";

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
  const unlockedAchievementKeys =
    items.some((i) => i.unlockType === "ACHIEVEMENT")
      ? new Set(
          (
            await prisma.userAchievement.findMany({
              where: { userId, unlockedAt: { not: null } },
              select: { achievement: { select: { key: true } } },
            })
          ).map((ua) => ua.achievement.key),
        )
      : new Set<string>();

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
      unlockedAchievementKeys,
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

/* ── Admin: katalog background animasi + frame avatar PNG ─────────────────── */

const ADMIN_BG_MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const ADMIN_BG_DIR = "gamification/backgrounds";
const ADMIN_FRAME_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ADMIN_FRAME_DIR = "gamification/avatar-frames";
const ADMIN_ACHIEVEMENT_MAX_FILE_BYTES = 15 * 1024 * 1024;
const ADMIN_ACHIEVEMENT_DIR = "gamification/achievements";
type AchievementSymbolMedia = "image" | "video" | "lottie" | "file";

function formText(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function slugifyKey(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 36) || "background"
  );
}

function parseAdminUnlock(formData: FormData): {
  unlockType: CosmeticUnlockType;
  unlockLevel: number | null;
  unlockAchievementKey: string | null;
} {
  const raw = formText(formData, "unlockType");
  const unlockType =
    raw === "FREE" || raw === "ACHIEVEMENT" || raw === "LEVEL"
      ? (raw as CosmeticUnlockType)
      : CosmeticUnlockType.LEVEL;
  const levelRaw = Number(formText(formData, "unlockLevel"));
  const unlockLevel =
    unlockType === CosmeticUnlockType.LEVEL
      ? Math.max(1, Math.min(50, Number.isFinite(levelRaw) ? Math.floor(levelRaw) : 1))
      : null;
  const achievementKey = formText(formData, "unlockAchievementKey");
  return {
    unlockType,
    unlockLevel,
    unlockAchievementKey:
      unlockType === CosmeticUnlockType.ACHIEVEMENT && achievementKey
        ? achievementKey.slice(0, 64)
        : null,
  };
}

function parseSortOrder(formData: FormData): number {
  const n = Number(formText(formData, "sortOrder"));
  return Number.isFinite(n) ? Math.max(0, Math.min(9999, Math.floor(n))) : 0;
}

/**
 * Focal point (`object-position`) — bagian aset yang tampil saat di-crop di hero
 * profil. Format "X% Y%", masing-masing 0–100. Default tengah bila tak valid.
 */
function parseFocalPoint(formData: FormData): string {
  const m = formText(formData, "focalPoint").match(
    /^(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%$/,
  );
  if (!m) return "50% 50%";
  const clamp = (v: string) => Math.max(0, Math.min(100, Number(v)));
  return `${clamp(m[1])}% ${clamp(m[2])}%`;
}

/** Skala zoom crop, 0.4–4 (1 = fit dasar). Default 1 bila tak valid. */
function parseZoom(formData: FormData): number {
  const n = Number(formText(formData, "zoom"));
  if (!Number.isFinite(n)) return 1;
  return Math.max(0.4, Math.min(4, Math.round(n * 100) / 100));
}

/** Mode fit: "contain" (utuh) / "cover" (penuhi bingkai). Default cover. */
function parseFit(formData: FormData): "cover" | "contain" {
  return formText(formData, "fit") === "contain" ? "contain" : "cover";
}

function revalidateProfileBackgroundViews() {
  revalidatePath("/admin/gamification");
  revalidatePath("/profile");
  revalidatePath("/profile/[userId]", "page");
  revalidatePath("/profile/edit");
}

function revalidateProfileCosmeticViews() {
  revalidateProfileBackgroundViews();
}

function sanitizeStoredName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 90) || "asset";
}

async function ensureAdminBgDir(): Promise<string> {
  const dir = path.join(getUploadPublicDir(), ADMIN_BG_DIR);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function ensureAdminFrameDir(): Promise<string> {
  const dir = path.join(getUploadPublicDir(), ADMIN_FRAME_DIR);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function ensureAdminAchievementDir(): Promise<string> {
  const dir = path.join(getUploadPublicDir(), ADMIN_ACHIEVEMENT_DIR);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function writeAdminBgFile(
  file: File,
  prefix: "loop" | "poster",
): Promise<{ publicPath: string; media: "image" | "video" | "lottie" }> {
  const raw = Buffer.from(await file.arrayBuffer());
  const dir = await ensureAdminBgDir();

  if (prefix === "poster") {
    if (raw.length > ADMIN_BG_MAX_IMAGE_BYTES) {
      throw new Error("Poster maksimal 12 MB.");
    }
    let poster: Buffer;
    try {
      poster = await sharp(raw)
        .rotate()
        .resize({ width: 2560, height: 1440, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
    } catch {
      throw new Error("Poster harus berupa gambar valid.");
    }
    const stored = `${randomUUID()}-${prefix}.webp`;
    await writeFile(path.join(dir, stored), poster);
    return { publicPath: `/uploads/${ADMIN_BG_DIR}/${stored}`, media: "image" };
  }

  const kind = detectCustomBackgroundKind(file);
  let body = raw;
  let ext = storedExtensionForKind(kind);

  if (kind === "image") {
    if (raw.length > ADMIN_BG_MAX_IMAGE_BYTES) {
      throw new Error("File gambar maksimal 12 MB.");
    }
    try {
      await sharp(raw).metadata();
    } catch {
      throw new Error("Gambar tidak valid atau rusak.");
    }
    const originalExt = path.extname(file.name || "").toLowerCase();
    if ([".png", ".jpg", ".jpeg", ".webp"].includes(originalExt)) {
      ext = originalExt.slice(1);
    }
  } else if (kind === "lottie-json") {
    body = Buffer.from(JSON.stringify(validateLottieJson(raw)), "utf8");
  } else if (kind === "lottie-dot") {
    validateDotLottie(raw);
  } else {
    validateMp4(raw);
  }

  const stored = `${randomUUID()}-${sanitizeStoredName(`${prefix}.${ext}`)}`;
  await writeFile(path.join(dir, stored), body);
  return {
    publicPath: `/uploads/${ADMIN_BG_DIR}/${stored}`,
    media: mediaForUploadKind(kind),
  };
}

async function writeAchievementSymbolFile(
  file: File,
): Promise<{
  publicPath: string;
  media: AchievementSymbolMedia;
  fileName: string;
}> {
  const raw = Buffer.from(await file.arrayBuffer());
  if (raw.length > ADMIN_ACHIEVEMENT_MAX_FILE_BYTES) {
    throw new Error("File simbol achievement maksimal 15 MB.");
  }

  const name = file.name || "symbol";
  const lower = name.toLowerCase();
  const dir = await ensureAdminAchievementDir();
  let body = raw;
  let ext = path.extname(lower).replace(".", "");
  let media: AchievementSymbolMedia = "file";

  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif") ||
    file.type.startsWith("image/")
  ) {
    try {
      const metadata = await sharp(raw).metadata();
      if (!metadata.format) throw new Error("invalid");
      if (!["png", "jpeg", "webp", "gif"].includes(metadata.format)) {
        throw new Error("unsupported");
      }
      ext = metadata.format === "jpeg" ? "jpg" : metadata.format;
      media = "image";
    } catch {
      throw new Error("Simbol gambar harus berupa PNG, JPG, WebP, atau GIF valid.");
    }
  } else if (lower.endsWith(".json") || file.type === "application/json") {
    body = Buffer.from(JSON.stringify(validateLottieJson(raw)), "utf8");
    ext = "json";
    media = "lottie";
  } else if (lower.endsWith(".lottie")) {
    validateDotLottie(raw);
    ext = "lottie";
    media = "lottie";
  } else if (lower.endsWith(".mp4") || file.type === "video/mp4") {
    validateMp4(raw);
    ext = "mp4";
    media = "video";
  } else if (lower.endsWith(".pdf") || file.type === "application/pdf") {
    if (raw.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error("PDF tidak valid.");
    }
    ext = "pdf";
    media = "file";
  } else {
    throw new Error(
      "Gunakan PNG/JPG/WebP/GIF, MP4, Lottie JSON, dotLottie, atau PDF.",
    );
  }

  const stored = `${randomUUID()}-${sanitizeStoredName(`achievement-symbol.${ext}`)}`;
  await writeFile(path.join(dir, stored), body);
  return {
    publicPath: `/uploads/${ADMIN_ACHIEVEMENT_DIR}/${stored}`,
    media,
    fileName: sanitizeStoredName(name),
  };
}

async function posterFromImageSource(file: File): Promise<string | null> {
  try {
    const raw = Buffer.from(await file.arrayBuffer());
    if (raw.length > ADMIN_BG_MAX_IMAGE_BYTES) return null;
    const dir = await ensureAdminBgDir();
    const poster = await sharp(raw)
      .rotate()
      .resize({ width: 2560, height: 1440, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();
    const stored = `${randomUUID()}-poster.webp`;
    await writeFile(path.join(dir, stored), poster);
    return `/uploads/${ADMIN_BG_DIR}/${stored}`;
  } catch {
    return null;
  }
}

export async function createGamificationBackground(formData: FormData) {
  await requireCeoOrAdministrator();

  const name = formText(formData, "name").slice(0, 120);
  if (!name) throw new Error("Nama background wajib diisi.");

  const animationFile = formData.get("animationFile");
  if (!(animationFile instanceof File) || animationFile.size === 0) {
    throw new Error("Upload file animasi background terlebih dahulu.");
  }

  const posterFile = formData.get("posterFile");
  const asset = await writeAdminBgFile(animationFile, "loop");
  let poster: string | undefined;
  if (posterFile instanceof File && posterFile.size > 0) {
    poster = (await writeAdminBgFile(posterFile, "poster")).publicPath;
  } else if (asset.media === "image") {
    poster = (await posterFromImageSource(animationFile)) ?? asset.publicPath;
  }

  const unlock = parseAdminUnlock(formData);
  const key = `bg-admin-${slugifyKey(name)}-${randomUUID().slice(0, 8)}`;

  await prisma.cosmeticItem.create({
    data: {
      key,
      name,
      type: "PROFILE_BACKGROUND",
      rarity: CosmeticRarity.RARE,
      previewRef: key,
      styleConfig: {
        effect: "asset-loop",
        src: asset.publicPath,
        poster: poster ?? null,
        media: asset.media,
        focalPoint: parseFocalPoint(formData),
        zoom: parseZoom(formData),
        fit: parseFit(formData),
      },
      unlockType: unlock.unlockType,
      unlockLevel: unlock.unlockLevel,
      unlockAchievementKey: unlock.unlockAchievementKey,
      isActive: formData.get("isActive") === "on",
      sortOrder: parseSortOrder(formData),
    },
  });

  revalidateProfileCosmeticViews();
}

export async function updateGamificationBackground(formData: FormData) {
  await requireCeoOrAdministrator();

  const id = formText(formData, "id");
  if (!id) throw new Error("Background tidak ditemukan.");
  const name = formText(formData, "name").slice(0, 120);
  if (!name) throw new Error("Nama background wajib diisi.");

  const unlock = parseAdminUnlock(formData);
  const existing = await prisma.cosmeticItem.findUnique({
    where: { id },
    select: { styleConfig: true },
  });
  if (!existing) throw new Error("Background tidak ditemukan.");
  const styleConfig = {
    ...((existing.styleConfig as Record<string, unknown> | null) ?? {}),
    focalPoint: parseFocalPoint(formData),
    zoom: parseZoom(formData),
    fit: parseFit(formData),
  };

  await prisma.cosmeticItem.update({
    where: { id },
    data: {
      name,
      styleConfig,
      unlockType: unlock.unlockType,
      unlockLevel: unlock.unlockLevel,
      unlockAchievementKey: unlock.unlockAchievementKey,
      sortOrder: parseSortOrder(formData),
      isActive: formData.get("isActive") === "on",
    },
  });

  revalidateProfileCosmeticViews();
}

async function writeAdminAvatarFrameFile(file: File): Promise<string> {
  const raw = Buffer.from(await file.arrayBuffer());
  if (raw.length > ADMIN_FRAME_MAX_IMAGE_BYTES) {
    throw new Error("File frame maksimal 8 MB.");
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(raw).metadata();
  } catch {
    throw new Error("Frame avatar harus berupa gambar PNG/WebP valid.");
  }

  if (metadata.format !== "png" && metadata.format !== "webp") {
    throw new Error("Frame avatar harus berupa PNG atau WebP transparan.");
  }
  if (!metadata.hasAlpha) {
    throw new Error("Frame avatar harus punya transparansi agar foto user tetap terlihat.");
  }

  const frame = await sharp(raw)
    .rotate()
    .resize({
      width: 1200,
      height: 1200,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  const dir = await ensureAdminFrameDir();
  const stored = `${randomUUID()}-frame.png`;
  await writeFile(path.join(dir, stored), frame);
  return `/uploads/${ADMIN_FRAME_DIR}/${stored}`;
}

function frameStyleConfig(
  src: string,
  scale: number,
  offsetX: number,
  offsetY: number,
): Prisma.InputJsonObject {
  return {
    effect: "asset-frame",
    src,
    poster: src,
    scale,
    offsetX,
    offsetY,
    media: "image",
  };
}

function parseFrameScale(formData: FormData): number {
  const n = Number(formText(formData, "scale"));
  if (!Number.isFinite(n)) return 1.28;
  return Math.max(0.9, Math.min(2, Math.round(n * 100) / 100));
}

function parseFrameOffset(formData: FormData, key: "offsetX" | "offsetY"): number {
  const n = Number(formText(formData, key));
  if (!Number.isFinite(n)) return 0;
  return Math.max(-50, Math.min(50, Math.round(n * 10) / 10));
}

export async function createGamificationAvatarFrame(formData: FormData) {
  await requireCeoOrAdministrator();

  const name = formText(formData, "name").slice(0, 120);
  if (!name) throw new Error("Nama frame wajib diisi.");

  const frameFile = formData.get("frameFile");
  if (!(frameFile instanceof File) || frameFile.size === 0) {
    throw new Error("Upload file PNG frame terlebih dahulu.");
  }

  const src = await writeAdminAvatarFrameFile(frameFile);
  const unlock = parseAdminUnlock(formData);
  const key = `frame-admin-${slugifyKey(name)}-${randomUUID().slice(0, 8)}`;

  await prisma.cosmeticItem.create({
    data: {
      key,
      name,
      type: "AVATAR_BORDER",
      rarity: CosmeticRarity.RARE,
      previewRef: key,
      styleConfig: frameStyleConfig(
        src,
        parseFrameScale(formData),
        parseFrameOffset(formData, "offsetX"),
        parseFrameOffset(formData, "offsetY"),
      ),
      unlockType: unlock.unlockType,
      unlockLevel: unlock.unlockLevel,
      unlockAchievementKey: unlock.unlockAchievementKey,
      isActive: formData.get("isActive") === "on",
      sortOrder: parseSortOrder(formData),
    },
  });

  revalidateProfileCosmeticViews();
}

export async function updateGamificationAvatarFrame(formData: FormData) {
  await requireCeoOrAdministrator();

  const id = formText(formData, "id");
  if (!id) throw new Error("Frame tidak ditemukan.");
  const name = formText(formData, "name").slice(0, 120);
  if (!name) throw new Error("Nama frame wajib diisi.");

  const existing = await prisma.cosmeticItem.findUnique({
    where: { id },
    select: { styleConfig: true, type: true },
  });
  if (!existing || existing.type !== "AVATAR_BORDER") {
    throw new Error("Frame tidak ditemukan.");
  }

  const frameFile = formData.get("frameFile");
  const oldConfig = (existing.styleConfig as Record<string, unknown> | null) ?? {};
  const src =
    frameFile instanceof File && frameFile.size > 0
      ? await writeAdminAvatarFrameFile(frameFile)
      : typeof oldConfig.src === "string"
        ? oldConfig.src
        : "";
  if (!src) throw new Error("File frame belum tersedia.");

  const unlock = parseAdminUnlock(formData);

  await prisma.cosmeticItem.update({
    where: { id },
    data: {
      name,
      styleConfig: frameStyleConfig(
        src,
        parseFrameScale(formData),
        parseFrameOffset(formData, "offsetX"),
        parseFrameOffset(formData, "offsetY"),
      ),
      unlockType: unlock.unlockType,
      unlockLevel: unlock.unlockLevel,
      unlockAchievementKey: unlock.unlockAchievementKey,
      sortOrder: parseSortOrder(formData),
      isActive: formData.get("isActive") === "on",
    },
  });

  revalidateProfileCosmeticViews();
}

export async function updateGamificationAchievementSymbol(formData: FormData) {
  await requireCeoOrAdministrator();

  const id = formText(formData, "id");
  if (!id) throw new Error("Achievement tidak ditemukan.");

  const fallbackIcon = formText(formData, "icon").slice(0, 48);
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(fallbackIcon)) {
    throw new Error("Nama ikon fallback tidak valid.");
  }

  const existing = await prisma.achievement.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new Error("Achievement tidak ditemukan.");

  const symbolFile = formData.get("symbolFile");
  const removeSymbol = formData.get("removeSymbol") === "on";

  const data: Prisma.AchievementUpdateInput = { icon: fallbackIcon };

  if (symbolFile instanceof File && symbolFile.size > 0) {
    const asset = await writeAchievementSymbolFile(symbolFile);
    data.symbolSrc = asset.publicPath;
    data.symbolMedia = asset.media;
    data.symbolPoster = asset.media === "image" ? asset.publicPath : null;
    data.symbolFileName = asset.fileName;
  } else if (removeSymbol) {
    data.symbolSrc = null;
    data.symbolMedia = null;
    data.symbolPoster = null;
    data.symbolFileName = null;
  }

  await prisma.achievement.update({
    where: { id },
    data,
  });

  revalidateProfileCosmeticViews();
}
