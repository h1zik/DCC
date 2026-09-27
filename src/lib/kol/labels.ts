/**
 * Label & nada tampilan KOL Hub — murni (tanpa Prisma) supaya bisa dipakai
 * komponen klien. Nilai kunci harus sama persis dengan enum Prisma.
 */

export type KolStatusValue =
  | "WAITING_APPROVAL"
  | "ACTIVE"
  | "BLACKLISTED"
  | "REJECTED";

export type KolScheduleStatusValue =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "SCHEDULED"
  | "POSTED"
  | "REJECTED"
  | "CANCELLED";

export type KolPlacementValue =
  | "FEED"
  | "REELS"
  | "STORY"
  | "CAROUSEL"
  | "VIDEO"
  | "LIVE";

export type KolObjectiveValue = "AWARENESS" | "CONSIDERATION" | "CONVERSION";

export type KolShipmentStatusValue =
  | "NOT_REQUIRED"
  | "PENDING"
  | "SHIPPED"
  | "DELIVERED";

export type KolPostStatusValue = "NOT_POSTED" | "POSTED" | "TAKEN_DOWN";

export type KolPlatformValue = "INSTAGRAM" | "TIKTOK";

export type KolChangeTypeValue =
  | "CREATE"
  | "EDIT"
  | "BLACKLIST"
  | "UNBLACKLIST";

export type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "muted";

export const KOL_STATUS_META: Record<
  KolStatusValue,
  { label: string; tone: Tone }
> = {
  WAITING_APPROVAL: { label: "Menunggu approval", tone: "warning" },
  ACTIVE: { label: "Aktif", tone: "success" },
  BLACKLISTED: { label: "Blacklist", tone: "danger" },
  REJECTED: { label: "Ditolak", tone: "muted" },
};

export const KOL_CHANGE_TYPE_LABEL: Record<KolChangeTypeValue, string> = {
  CREATE: "Profil baru",
  EDIT: "Perubahan data",
  BLACKLIST: "Blacklist",
  UNBLACKLIST: "Buka blacklist",
};

export const SCHEDULE_STATUS_META: Record<
  KolScheduleStatusValue,
  { label: string; tone: Tone }
> = {
  DRAFT: { label: "Draf", tone: "neutral" },
  PENDING_APPROVAL: { label: "Menunggu approval", tone: "warning" },
  APPROVED: { label: "Disetujui", tone: "info" },
  SCHEDULED: { label: "Siap tayang", tone: "info" },
  POSTED: { label: "Tayang", tone: "success" },
  REJECTED: { label: "Ditolak", tone: "danger" },
  CANCELLED: { label: "Dibatalkan", tone: "muted" },
};

/** Urutan status jadwal untuk tab & ringkasan. */
export const SCHEDULE_STATUS_ORDER: KolScheduleStatusValue[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SCHEDULED",
  "POSTED",
  "REJECTED",
  "CANCELLED",
];

/** Status yang memakai budget campaign (komitmen biaya). */
export const BUDGET_COMMITTED_STATUSES: KolScheduleStatusValue[] = [
  "PENDING_APPROVAL",
  "APPROVED",
  "SCHEDULED",
  "POSTED",
];

export const PLACEMENT_LABEL: Record<KolPlacementValue, string> = {
  FEED: "Feed",
  REELS: "Reels",
  STORY: "Story",
  CAROUSEL: "Carousel",
  VIDEO: "Video",
  LIVE: "Live",
};

/** Placement yang masuk akal per platform. */
export const PLACEMENTS_BY_PLATFORM: Record<KolPlatformValue, KolPlacementValue[]> = {
  INSTAGRAM: ["REELS", "FEED", "CAROUSEL", "STORY", "LIVE"],
  TIKTOK: ["VIDEO", "STORY", "LIVE"],
};

export const OBJECTIVE_META: Record<
  KolObjectiveValue,
  { label: string; hint: string }
> = {
  AWARENESS: { label: "Awareness", hint: "Memperkenalkan brand ke audiens baru" },
  CONSIDERATION: {
    label: "Consideration",
    hint: "Membuat audiens menimbang untuk membeli",
  },
  CONVERSION: { label: "Conversion", hint: "Mendorong pembelian langsung" },
};

export const SHIPMENT_META: Record<
  KolShipmentStatusValue,
  { label: string; tone: Tone }
> = {
  NOT_REQUIRED: { label: "Tanpa kirim produk", tone: "muted" },
  PENDING: { label: "Produk belum dikirim", tone: "warning" },
  SHIPPED: { label: "Produk dikirim", tone: "info" },
  DELIVERED: { label: "Produk diterima", tone: "success" },
};

export const POST_STATUS_META: Record<
  KolPostStatusValue,
  { label: string; tone: Tone }
> = {
  NOT_POSTED: { label: "Belum tayang", tone: "neutral" },
  POSTED: { label: "Sudah tayang", tone: "success" },
  TAKEN_DOWN: { label: "Diturunkan", tone: "danger" },
};

export type KolPaymentStatusValue = "NONE" | "WAITING" | "APPROVED" | "PAID" | "REJECTED";

/** Status bayar — dibaca live dari pengajuan dana Finance. */
export const PAYMENT_META: Record<KolPaymentStatusValue, { label: string; tone: Tone }> = {
  NONE: { label: "Tanpa pembayaran", tone: "muted" },
  WAITING: { label: "Menunggu Finance", tone: "warning" },
  APPROVED: { label: "Siap dibayar", tone: "info" },
  PAID: { label: "Dibayar", tone: "success" },
  REJECTED: { label: "Pembayaran ditolak", tone: "danger" },
};

export type KolSpkStatusValue = "GENERATED" | "SENT" | "SIGNED";

export const SPK_META: Record<KolSpkStatusValue, { label: string; tone: Tone }> = {
  GENERATED: { label: "SPK dibuat", tone: "neutral" },
  SENT: { label: "SPK dikirim", tone: "info" },
  SIGNED: { label: "SPK ditandatangani", tone: "success" },
};

export const PLATFORM_LABEL: Record<KolPlatformValue, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
};

export const TIER_LABEL: Record<string, string> = {
  NANO: "Nano",
  MICRO: "Micro",
  MID: "Mid",
  MACRO: "Macro",
  MEGA: "Mega",
};

/** Kelas warna badge per nada — dipakai `KolBadge`. */
export const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-muted text-foreground/80 ring-border",
  info: "bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_12%,transparent)] text-[var(--lab-accent,var(--primary))] ring-[color-mix(in_srgb,var(--lab-accent,var(--primary))_28%,transparent)]",
  warning:
    "bg-amber-500/12 text-amber-800 ring-amber-500/30 dark:text-amber-300",
  success:
    "bg-emerald-500/12 text-emerald-800 ring-emerald-500/30 dark:text-emerald-300",
  danger: "bg-red-500/12 text-red-700 ring-red-500/30 dark:text-red-300",
  muted: "bg-muted/60 text-muted-foreground ring-border/70",
};
