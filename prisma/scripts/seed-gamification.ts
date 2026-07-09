/**
 * Seed katalog gamifikasi profil (idempotent, aman diulang & aman di produksi).
 * Meng-`upsert` CosmeticItem + Achievement berdasarkan `key` unik — TIDAK menyentuh
 * data user. Katalog ini data-driven; menambah item = edit array di sini lalu re-run.
 *
 *   npx tsx prisma/scripts/seed-gamification.ts
 *   (atau `npm run db:seed-gamification`)
 *
 * FREE cosmetics (background preset & avatar frame) DIDERIVASI dari konstanta lama
 * `src/lib/profile-appearance.ts` supaya "grandfather" — tak ada yang hilang & tetap
 * sinkron. Warna item EARNED selalu dari token tema aktif (`palette:"theme"`),
 * `styleConfig` hanya mereferensi preset animasi terkurasi — bukan CSS/JS user.
 *
 * Catatan: "showcase slot" TIDAK di-seed sebagai cosmetic (bukan CosmeticType);
 * jumlah slot diturunkan dari level di engine (FASE 3).
 */
import {
  AchievementCategory,
  AchievementTier,
  CosmeticRarity,
  CosmeticType,
  CosmeticUnlockType,
  type Prisma,
} from "@prisma/client";
import { prisma } from "../../src/lib/prisma";
import {
  PROFILE_AVATAR_FRAMES,
  PROFILE_AVATAR_FRAME_IDS,
  PROFILE_BANNER_PRESET_IDS,
  PROFILE_BANNER_PRESETS,
} from "../../src/lib/profile-appearance";

type CosmeticSeed = {
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

type AchievementSeed = {
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

const freeBackgroundPresets: CosmeticSeed[] = PROFILE_BANNER_PRESET_IDS.map(
  (preset, i) => ({
    key: `bg-preset-${preset}`,
    name: PROFILE_BANNER_PRESETS[preset].label,
    type: CosmeticType.PROFILE_BACKGROUND,
    rarity: CosmeticRarity.COMMON,
    previewRef: preset,
    styleConfig: { effect: "gradient", preset },
    unlockType: CosmeticUnlockType.FREE,
    sortOrder: 100 + i,
  }),
);

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
  {
    key: "bg-upload-slot",
    name: "Latar Unggahan",
    type: CosmeticType.PROFILE_BACKGROUND,
    rarity: CosmeticRarity.COMMON,
    previewRef: "upload",
    styleConfig: { effect: "image", src: "user-upload" },
    unlockType: CosmeticUnlockType.CUSTOM_UPLOAD,
    sortOrder: 302,
  },
];

/* ── EARNED cosmetics — level/achievement gated, animated, palette=theme ───── */

const earnedCosmetics: CosmeticSeed[] = [
  // Backgrounds
  {
    key: "bg-aurora",
    name: "Aurora Hidup",
    type: CosmeticType.PROFILE_BACKGROUND,
    rarity: CosmeticRarity.RARE,
    previewRef: "aurora",
    styleConfig: { effect: "aurora-webgl", palette: "theme", intensity: 2 },
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
    styleConfig: { effect: "bokeh-webgl", palette: "theme", particles: 40 },
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
    styleConfig: { effect: "parallax", palette: "theme", layers: 3 },
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
    styleConfig: { effect: "shader-flux", palette: "theme", intensity: 1 },
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
    styleConfig: { effect: "holographic", asset: "apng" },
    unlockType: CosmeticUnlockType.LEVEL,
    unlockLevel: 12,
    sortOrder: 412,
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

const cosmetics: CosmeticSeed[] = [
  ...freeBackgroundPresets,
  ...freeAvatarFrames,
  ...freeExtras,
  ...earnedCosmetics,
];

/* ── Achievements ─────────────────────────────────────────────────────────── */

const achievements: AchievementSeed[] = [
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

export async function seedGamificationCatalog() {
  for (const c of cosmetics) {
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

  for (const a of achievements) {
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

  return { cosmetics: cosmetics.length, achievements: achievements.length };
}

async function main() {
  const result = await seedGamificationCatalog();
  console.log(
    `Seed gamifikasi selesai: ${result.cosmetics} cosmetics, ${result.achievements} achievements.`,
  );
}

// Jalankan hanya bila dipanggil langsung (bukan saat di-import dari FASE 3 dst).
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
