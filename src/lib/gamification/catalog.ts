/**
 * Katalog gamifikasi profil — SUMBER KEBENARAN di kode.
 *
 * Berisi definisi CosmeticItem (frame, border, nameplate, gelar — free & earned)
 * dan Achievement. `seedGamificationCatalog()` meng-`upsert` semuanya berdasarkan
 * `key` unik (idempotent, tak menyentuh data user). `ensureGamificationCatalog()`
 * membungkusnya dengan penjaga hash-versi dan dipanggil OTOMATIS saat server boot
 * (lihat `src/instrumentation.ts`) — jadi katalog auto-sync tiap deploy tanpa perlu
 * `npm run db:seed-gamification` manual di produksi.
 *
 * Yang TIDAK ada di sini (sengaja):
 *  - Preset gradient banner (Twilight–Candy): di-hard-code di editor & disimpan di
 *    `User.profileBannerPreset`, persis mode non-gamifikasi.
 *  - Kosmetik yang diunggah admin (background/frame animasi): baris DB dinamis
 *    dengan `key` berbeda — TIDAK disentuh sync ini (hanya `key` di katalog yang
 *    di-upsert), jadi item admin & status aktif/nonaktifnya tetap utuh.
 *
 * Warna item EARNED selalu dari token tema aktif (`palette:"theme"`); `styleConfig`
 * hanya mereferensi preset animasi terkurasi — bukan CSS/JS user.
 */
import { createHash } from "node:crypto";
import {
  AchievementCategory,
  AchievementTier,
  CosmeticRarity,
  CosmeticType,
  CosmeticUnlockType,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BRANDING_ID } from "@/lib/app-branding";
import {
  COSMETIC_BG_ASSETS,
  COSMETIC_BORDER_ASSETS,
} from "@/lib/gamification/cosmetic-assets";
import {
  PROFILE_AVATAR_FRAMES,
  PROFILE_AVATAR_FRAME_IDS,
} from "@/lib/profile-appearance";

function bgAsset(key: keyof typeof COSMETIC_BG_ASSETS): Prisma.InputJsonValue {
  const a = COSMETIC_BG_ASSETS[key];
  return {
    effect: "asset-loop",
    src: a.src,
    poster: a.poster,
    media: a.media,
  };
}

export type CosmeticSeed = {
  key: string;
  name: string;
  type: CosmeticType;
  rarity: CosmeticRarity;
  previewRef: string;
  styleConfig: Prisma.InputJsonValue;
  unlockType: CosmeticUnlockType;
  unlockLevel?: number | null;
  unlockAchievementKey?: string | null;
  sortOrder: number;
};

export type AchievementSeed = {
  key: string;
  name: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  icon: string;
  xpReward: number;
  criteria: Prisma.InputJsonValue;
  unlocksCosmeticKey?: string | null;
  hidden?: boolean;
  sortOrder: number;
};

/* ── FREE cosmetics — grandfather dari konstanta appearance lama ───────────── */

const freeAvatarFrames: CosmeticSeed[] = PROFILE_AVATAR_FRAME_IDS.map(
  (frame, i) => ({
    key: `border-${frame}`,
    name: `Frame ${PROFILE_AVATAR_FRAMES[frame].label}`,
    type: CosmeticType.AVATAR_BORDER,
    rarity: CosmeticRarity.COMMON,
    previewRef: frame,
    styleConfig: { effect: "static-frame", variant: frame },
    unlockType: CosmeticUnlockType.FREE,
    sortOrder: 200 + i,
  }),
);

const freeExtras: CosmeticSeed[] = [
  {
    key: "accent-custom",
    name: "Aksen Kustom",
    type: CosmeticType.ACCENT,
    rarity: CosmeticRarity.COMMON,
    previewRef: "accent",
    styleConfig: { effect: "accent", source: "user-hex" },
    unlockType: CosmeticUnlockType.FREE,
    sortOrder: 300,
  },
  {
    key: "border-color-custom",
    name: "Warna Border Kustom",
    type: CosmeticType.AVATAR_BORDER,
    rarity: CosmeticRarity.COMMON,
    previewRef: "border-color",
    styleConfig: { effect: "static-frame", color: "user-hex" },
    unlockType: CosmeticUnlockType.FREE,
    sortOrder: 301,
  },
];

/* ── EARNED cosmetics — level/achievement gated, animated asset-loop ───────── */

const earnedCosmetics: CosmeticSeed[] = [
  // Backgrounds (animated WebP/WebM kurasi — lihat public/cosmetics/)
  {
    key: "bg-aurora",
    name: "Aurora Hidup",
    type: CosmeticType.PROFILE_BACKGROUND,
    rarity: CosmeticRarity.RARE,
    previewRef: "aurora",
    styleConfig: bgAsset("aurora"),
    unlockType: CosmeticUnlockType.ACHIEVEMENT,
    unlockAchievementKey: "attendance_30",
    sortOrder: 400,
  },
  {
    key: "bg-bokeh",
    name: "Bokeh Melayang",
    type: CosmeticType.PROFILE_BACKGROUND,
    rarity: CosmeticRarity.RARE,
    previewRef: "bokeh",
    styleConfig: bgAsset("bokeh"),
    unlockType: CosmeticUnlockType.ACHIEVEMENT,
    unlockAchievementKey: "firefighter",
    sortOrder: 401,
  },
  {
    key: "bg-parallax",
    name: "Parallax Nebula",
    type: CosmeticType.PROFILE_BACKGROUND,
    rarity: CosmeticRarity.EPIC,
    previewRef: "parallax",
    styleConfig: bgAsset("parallax"),
    unlockType: CosmeticUnlockType.ACHIEVEMENT,
    unlockAchievementKey: "night_owl",
    sortOrder: 402,
  },
  {
    key: "bg-shader-flux",
    name: "Flux Shader",
    type: CosmeticType.PROFILE_BACKGROUND,
    rarity: CosmeticRarity.EPIC,
    previewRef: "shader-flux",
    styleConfig: bgAsset("shader-flux"),
    unlockType: CosmeticUnlockType.LEVEL,
    unlockLevel: 15,
    sortOrder: 403,
  },
  // Avatar borders / frames
  {
    key: "border-orbit",
    name: "Orbit Glow",
    type: CosmeticType.AVATAR_BORDER,
    rarity: CosmeticRarity.RARE,
    previewRef: "orbit",
    styleConfig: { effect: "orbit-glow", palette: "theme" },
    unlockType: CosmeticUnlockType.ACHIEVEMENT,
    unlockAchievementKey: "attendance_7",
    sortOrder: 410,
  },
  {
    key: "border-foil",
    name: "Foil Prisma",
    type: CosmeticType.AVATAR_BORDER,
    rarity: CosmeticRarity.EPIC,
    previewRef: "foil",
    styleConfig: { effect: "foil", palette: "theme" },
    unlockType: CosmeticUnlockType.ACHIEVEMENT,
    unlockAchievementKey: "task_ontime_50",
    sortOrder: 411,
  },
  {
    key: "border-holo",
    name: "Holografik",
    type: CosmeticType.AVATAR_BORDER,
    rarity: CosmeticRarity.EPIC,
    previewRef: "holo",
    styleConfig: {
      effect: "asset-frame",
      src: COSMETIC_BORDER_ASSETS.holo.src,
      poster: COSMETIC_BORDER_ASSETS.holo.poster,
    },
    unlockType: CosmeticUnlockType.LEVEL,
    unlockLevel: 12,
    sortOrder: 412,
  },
  // Frame CSS beranimasi tambahan (lihat src/lib/gamification/frame-styles.ts).
  // Tiga pertama FREE supaya langsung ada variasi; sisanya gated progresi.
  {
    key: "border-neon",
    name: "Nadi Neon",
    type: CosmeticType.AVATAR_BORDER,
    rarity: CosmeticRarity.RARE,
    previewRef: "neon-pulse",
    styleConfig: { effect: "neon-pulse", palette: "theme" },
    unlockType: CosmeticUnlockType.FREE,
    sortOrder: 413,
  },
  {
    key: "border-frost",
    name: "Halo Beku",
    type: CosmeticType.AVATAR_BORDER,
    rarity: CosmeticRarity.RARE,
    previewRef: "frost",
    styleConfig: { effect: "frost", palette: "theme" },
    unlockType: CosmeticUnlockType.FREE,
    sortOrder: 414,
  },
  {
    key: "border-sunset",
    name: "Senja",
    type: CosmeticType.AVATAR_BORDER,
    rarity: CosmeticRarity.RARE,
    previewRef: "sunset",
    styleConfig: { effect: "sunset", palette: "theme" },
    unlockType: CosmeticUnlockType.FREE,
    sortOrder: 415,
  },
  {
    key: "border-aurora-ring",
    name: "Tirai Aurora",
    type: CosmeticType.AVATAR_BORDER,
    rarity: CosmeticRarity.EPIC,
    previewRef: "aurora",
    styleConfig: { effect: "aurora", palette: "theme" },
    unlockType: CosmeticUnlockType.LEVEL,
    unlockLevel: 8,
    sortOrder: 416,
  },
  {
    key: "border-ember",
    name: "Bara Api",
    type: CosmeticType.AVATAR_BORDER,
    rarity: CosmeticRarity.EPIC,
    previewRef: "ember",
    styleConfig: { effect: "ember", palette: "theme" },
    unlockType: CosmeticUnlockType.LEVEL,
    unlockLevel: 14,
    sortOrder: 417,
  },
  {
    key: "border-venom",
    name: "Bisa Toksik",
    type: CosmeticType.AVATAR_BORDER,
    rarity: CosmeticRarity.EPIC,
    previewRef: "venom",
    styleConfig: { effect: "venom", palette: "theme" },
    unlockType: CosmeticUnlockType.LEVEL,
    unlockLevel: 20,
    sortOrder: 418,
  },
  {
    key: "border-gold",
    name: "Emas Mewah",
    type: CosmeticType.AVATAR_BORDER,
    rarity: CosmeticRarity.LEGENDARY,
    previewRef: "gold-luxe",
    styleConfig: { effect: "gold-luxe", palette: "theme" },
    unlockType: CosmeticUnlockType.LEVEL,
    unlockLevel: 25,
    sortOrder: 418.3,
  },
  {
    key: "border-spectrum",
    name: "Spektrum",
    type: CosmeticType.AVATAR_BORDER,
    rarity: CosmeticRarity.LEGENDARY,
    previewRef: "spectrum",
    styleConfig: { effect: "spectrum", palette: "theme" },
    unlockType: CosmeticUnlockType.LEVEL,
    unlockLevel: 35,
    sortOrder: 418.6,
  },
  // Nameplates
  {
    key: "nameplate-plain",
    name: "Nameplate Polos",
    type: CosmeticType.NAMEPLATE,
    rarity: CosmeticRarity.COMMON,
    previewRef: "plain",
    styleConfig: { effect: "plain", palette: "theme" },
    unlockType: CosmeticUnlockType.FREE,
    sortOrder: 419,
  },
  {
    key: "nameplate-bronze",
    name: "Nameplate Perunggu",
    type: CosmeticType.NAMEPLATE,
    rarity: CosmeticRarity.RARE,
    previewRef: "bronze",
    styleConfig: { effect: "molten", palette: "theme", intensity: 0.6 },
    unlockType: CosmeticUnlockType.LEVEL,
    unlockLevel: 5,
    sortOrder: 419.5,
  },
  {
    key: "nameplate-molten",
    name: "Nameplate Molten",
    type: CosmeticType.NAMEPLATE,
    rarity: CosmeticRarity.LEGENDARY,
    previewRef: "molten",
    styleConfig: { effect: "molten", palette: "theme" },
    unlockType: CosmeticUnlockType.ACHIEVEMENT,
    unlockAchievementKey: "attendance_100",
    sortOrder: 420,
  },
  {
    key: "nameplate-glass",
    name: "Nameplate Kaca",
    type: CosmeticType.NAMEPLATE,
    rarity: CosmeticRarity.EPIC,
    previewRef: "glass",
    styleConfig: { effect: "glass", palette: "theme" },
    unlockType: CosmeticUnlockType.ACHIEVEMENT,
    unlockAchievementKey: "data_curator",
    sortOrder: 421,
  },
  // Titles
  {
    key: "title-newcomer",
    name: 'Gelar "Anggota Baru"',
    type: CosmeticType.TITLE,
    rarity: CosmeticRarity.COMMON,
    previewRef: "title",
    styleConfig: { effect: "title", text: "Anggota Baru" },
    unlockType: CosmeticUnlockType.FREE,
    sortOrder: 429,
  },
  {
    key: "title-veteran",
    name: 'Gelar "Veteran"',
    type: CosmeticType.TITLE,
    rarity: CosmeticRarity.RARE,
    previewRef: "title",
    styleConfig: { effect: "title", text: "Veteran" },
    unlockType: CosmeticUnlockType.LEVEL,
    unlockLevel: 5,
    sortOrder: 429.5,
  },
  {
    key: "title-lvl10",
    name: 'Gelar "Level 10"',
    type: CosmeticType.TITLE,
    rarity: CosmeticRarity.RARE,
    previewRef: "title",
    styleConfig: { effect: "title", text: "Level 10" },
    unlockType: CosmeticUnlockType.ACHIEVEMENT,
    unlockAchievementKey: "level_10",
    sortOrder: 430,
  },
  {
    key: "title-founder",
    name: 'Gelar "Anggota Perintis"',
    type: CosmeticType.TITLE,
    rarity: CosmeticRarity.LEGENDARY,
    previewRef: "title",
    styleConfig: { effect: "title", text: "Anggota Perintis" },
    unlockType: CosmeticUnlockType.ACHIEVEMENT,
    unlockAchievementKey: "founding_member",
    sortOrder: 431,
  },
  {
    key: "title-clean",
    name: 'Gelar "Papan Bersih"',
    type: CosmeticType.TITLE,
    rarity: CosmeticRarity.RARE,
    previewRef: "title",
    styleConfig: { effect: "title", text: "Papan Bersih" },
    unlockType: CosmeticUnlockType.ACHIEVEMENT,
    unlockAchievementKey: "clean_board",
    sortOrder: 432,
  },
  {
    key: "title-role-flair",
    name: "Flair Peran",
    type: CosmeticType.TITLE,
    rarity: CosmeticRarity.RARE,
    previewRef: "title",
    styleConfig: { effect: "title", source: "role" },
    unlockType: CosmeticUnlockType.LEVEL,
    unlockLevel: 8,
    sortOrder: 433,
  },
];

export const COSMETIC_CATALOG: CosmeticSeed[] = [
  ...freeAvatarFrames,
  ...freeExtras,
  ...earnedCosmetics,
];

/* ── Achievements ─────────────────────────────────────────────────────────── */

export const ACHIEVEMENT_CATALOG: AchievementSeed[] = [
  {
    key: "attendance_7",
    name: "Rajin Seminggu",
    description: "Check-in terverifikasi 7 hari kerja beruntun.",
    category: AchievementCategory.ATTENDANCE,
    tier: AchievementTier.BRONZE,
    icon: "CalendarCheck",
    xpReward: 100,
    criteria: { type: "attendance_streak", threshold: 7 },
    unlocksCosmeticKey: "border-orbit",
    sortOrder: 10,
  },
  {
    key: "attendance_30",
    name: "Sebulan Penuh",
    description: "Streak check-in terverifikasi 30 hari.",
    category: AchievementCategory.ATTENDANCE,
    tier: AchievementTier.SILVER,
    icon: "CalendarHeart",
    xpReward: 300,
    criteria: { type: "attendance_streak", threshold: 30 },
    unlocksCosmeticKey: "bg-aurora",
    sortOrder: 11,
  },
  {
    key: "attendance_100",
    name: "Legenda Absensi",
    description: "Streak check-in terverifikasi 100 hari.",
    category: AchievementCategory.ATTENDANCE,
    tier: AchievementTier.GOLD,
    icon: "Flame",
    xpReward: 800,
    criteria: { type: "attendance_streak", threshold: 100 },
    unlocksCosmeticKey: "nameplate-molten",
    sortOrder: 12,
  },
  {
    key: "task_ontime_10",
    name: "Tepat Waktu",
    description: "Selesaikan 10 tugas tepat waktu (≤ tenggat).",
    category: AchievementCategory.TASK,
    tier: AchievementTier.BRONZE,
    icon: "CircleCheckBig",
    xpReward: 150,
    criteria: { type: "task_ontime_count", threshold: 10 },
    sortOrder: 20,
  },
  {
    key: "task_ontime_50",
    name: "Mesin Deadline",
    description: "Selesaikan 50 tugas tepat waktu (≤ tenggat).",
    category: AchievementCategory.TASK,
    tier: AchievementTier.GOLD,
    icon: "Gauge",
    xpReward: 600,
    criteria: { type: "task_ontime_count", threshold: 50 },
    unlocksCosmeticKey: "border-foil",
    sortOrder: 21,
  },
  {
    key: "clean_board",
    name: "Papan Bersih",
    description: "Tidak ada tugas overdue selama 1 minggu penuh.",
    category: AchievementCategory.TASK,
    tier: AchievementTier.SILVER,
    icon: "Sparkles",
    xpReward: 250,
    criteria: { type: "zero_overdue_days", threshold: 7 },
    unlocksCosmeticKey: "title-clean",
    sortOrder: 22,
  },
  {
    key: "firefighter",
    name: "Pemadam Kebakaran",
    description: "Tutup 5 tugas OVERDUE dalam 7 hari.",
    category: AchievementCategory.TASK,
    tier: AchievementTier.SILVER,
    icon: "Siren",
    xpReward: 250,
    criteria: { type: "overdue_recovered", threshold: 5, windowDays: 7 },
    unlocksCosmeticKey: "bg-bokeh",
    sortOrder: 23,
  },
  {
    key: "data_curator",
    name: "Kurator Data",
    description: "Jaga ≥3 modul tetap fresh 4 minggu berturut.",
    category: AchievementCategory.DATA,
    tier: AchievementTier.GOLD,
    icon: "DatabaseZap",
    xpReward: 400,
    criteria: { type: "fresh_modules_weeks", modules: 3, weeks: 4 },
    unlocksCosmeticKey: "nameplate-glass",
    sortOrder: 30,
  },
  {
    key: "founding_member",
    name: "Anggota Perintis",
    description: "Bergabung ≥180 hari bersama tim.",
    category: AchievementCategory.MILESTONE,
    tier: AchievementTier.PLATINUM,
    icon: "Crown",
    xpReward: 500,
    criteria: { type: "tenure_days", threshold: 180 },
    unlocksCosmeticKey: "title-founder",
    sortOrder: 40,
  },
  {
    key: "level_10",
    name: "Naik Kelas",
    description: "Capai Level 10.",
    category: AchievementCategory.MILESTONE,
    tier: AchievementTier.SILVER,
    icon: "TrendingUp",
    xpReward: 200,
    criteria: { type: "level_reached", threshold: 10 },
    unlocksCosmeticKey: "title-lvl10",
    sortOrder: 41,
  },
  {
    key: "night_owl",
    name: "Kalong Kantor 🦉",
    description: "Check-in terverifikasi sebelum jam 07:00 sebanyak 5×.",
    category: AchievementCategory.ATTENDANCE,
    tier: AchievementTier.SILVER,
    icon: "Moon",
    xpReward: 250,
    criteria: { type: "checkin_before_hour", hour: 7, count: 5 },
    unlocksCosmeticKey: "bg-parallax",
    hidden: true,
    sortOrder: 50,
  },
  {
    key: "comeback_kid",
    name: "Balik Lagi",
    description: "Bangun streak baru ≥7 hari setelah streak putus.",
    category: AchievementCategory.ATTENDANCE,
    tier: AchievementTier.BRONZE,
    icon: "Undo2",
    xpReward: 120,
    criteria: { type: "streak_rebuilt", threshold: 7 },
    hidden: true,
    sortOrder: 51,
  },
];

/* ── Seed runner (idempotent) ─────────────────────────────────────────────── */

/**
 * Upsert seluruh katalog (cosmetics + achievements) berdasarkan `key`. Idempotent
 * & aman diulang. Hanya menyentuh baris dengan `key` di katalog kode — kosmetik
 * yang diunggah admin (key berbeda) tidak tersentuh.
 */
export async function seedGamificationCatalog() {
  for (const c of COSMETIC_CATALOG) {
    await prisma.cosmeticItem.upsert({
      where: { key: c.key },
      create: {
        key: c.key,
        name: c.name,
        type: c.type,
        rarity: c.rarity,
        previewRef: c.previewRef,
        styleConfig: c.styleConfig,
        unlockType: c.unlockType,
        unlockLevel: c.unlockLevel ?? null,
        unlockAchievementKey: c.unlockAchievementKey ?? null,
        sortOrder: c.sortOrder,
        isActive: true,
      },
      update: {
        name: c.name,
        type: c.type,
        rarity: c.rarity,
        previewRef: c.previewRef,
        styleConfig: c.styleConfig,
        unlockType: c.unlockType,
        unlockLevel: c.unlockLevel ?? null,
        unlockAchievementKey: c.unlockAchievementKey ?? null,
        sortOrder: c.sortOrder,
        isActive: true,
      },
    });
  }

  for (const a of ACHIEVEMENT_CATALOG) {
    await prisma.achievement.upsert({
      where: { key: a.key },
      create: {
        key: a.key,
        name: a.name,
        description: a.description,
        category: a.category,
        tier: a.tier,
        icon: a.icon,
        xpReward: a.xpReward,
        criteria: a.criteria,
        unlocksCosmeticKey: a.unlocksCosmeticKey ?? null,
        hidden: a.hidden ?? false,
        sortOrder: a.sortOrder,
        isActive: true,
      },
      update: {
        name: a.name,
        description: a.description,
        category: a.category,
        tier: a.tier,
        icon: a.icon,
        xpReward: a.xpReward,
        criteria: a.criteria,
        unlocksCosmeticKey: a.unlocksCosmeticKey ?? null,
        hidden: a.hidden ?? false,
        sortOrder: a.sortOrder,
        isActive: true,
      },
    });
  }

  return {
    cosmetics: COSMETIC_CATALOG.length,
    achievements: ACHIEVEMENT_CATALOG.length,
  };
}

/* ── Auto-sync (dipanggil dari instrumentation saat boot) ─────────────────── */

/** Hash stabil dari definisi katalog — berubah hanya bila isi katalog berubah. */
export function gamificationCatalogVersion(): string {
  const payload = JSON.stringify({
    cosmetics: COSMETIC_CATALOG,
    achievements: ACHIEVEMENT_CATALOG,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

/**
 * Sinkronkan katalog ke DB HANYA bila definisinya berubah sejak sync terakhir
 * (dijaga hash-versi di `AppBranding.gamificationCatalogVersion`). Boot normal =
 * satu SELECT lalu berhenti. Aman dipanggil berkali-kali & konkuren (upsert
 * idempotent, versi ditulis paling akhir).
 */
export async function ensureGamificationCatalog(): Promise<{
  applied: boolean;
  version: string;
}> {
  const version = gamificationCatalogVersion();
  const existing = await prisma.appBranding.findUnique({
    where: { id: BRANDING_ID },
    select: { gamificationCatalogVersion: true },
  });
  if (existing?.gamificationCatalogVersion === version) {
    return { applied: false, version };
  }

  await seedGamificationCatalog();
  await prisma.appBranding.upsert({
    where: { id: BRANDING_ID },
    update: { gamificationCatalogVersion: version },
    create: { id: BRANDING_ID, gamificationCatalogVersion: version },
  });
  return { applied: true, version };
}
