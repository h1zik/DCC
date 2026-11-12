import {
  ContentPlanUsage,
  RoomCalendarEventKind,
  RoomCampaignStatus,
} from "@prisma/client";

/**
 * Kosakata tampilan kalender campaign: palet, label status/objective, channel,
 * dan jenis aktivitas. Dipakai klien dan server action (validasi kunci).
 *
 * Aturan warna: warna hanya berarti "campaign yang mana". Jenis aktivitas
 * dibedakan lewat ikon, status campaign lewat tekstur pita.
 */

export const CAMPAIGN_COLOR_KEYS = [
  "rose",
  "orange",
  "amber",
  "emerald",
  "teal",
  "sky",
  "violet",
  "fuchsia",
] as const;

export type CampaignColorKey = (typeof CAMPAIGN_COLOR_KEYS)[number];

/**
 * Satu nilai warna per campaign, dipasang sebagai CSS variable `--cmp` lalu
 * diturunkan dengan `color-mix` (lihat `campaignStyle`). Teks di atas pita
 * tetap memakai warna teks tema, jadi terbaca di tema terang, gelap, dan
 * tema kustom pengguna.
 */
export const CAMPAIGN_COLORS: Record<CampaignColorKey, { label: string; value: string }> = {
  rose: { label: "Merah mawar", value: "#e11d48" },
  orange: { label: "Jingga", value: "#ea580c" },
  amber: { label: "Kuning madu", value: "#d99a06" },
  emerald: { label: "Hijau", value: "#059669" },
  teal: { label: "Toska", value: "#0d9488" },
  sky: { label: "Biru langit", value: "#0284c7" },
  violet: { label: "Ungu", value: "#7c3aed" },
  fuchsia: { label: "Magenta", value: "#c026d3" },
};

export function isCampaignColorKey(value: string): value is CampaignColorKey {
  return (CAMPAIGN_COLOR_KEYS as readonly string[]).includes(value);
}

export function campaignColorValue(key: string | null | undefined): string {
  return key && isCampaignColorKey(key) ? CAMPAIGN_COLORS[key].value : "var(--muted-foreground)";
}

/** Style inline yang memasang `--cmp`; dipakai bersama kelas `*-[var(--cmp)]`. */
export function campaignStyle(key: string | null | undefined): React.CSSProperties {
  return { "--cmp": campaignColorValue(key) } as React.CSSProperties;
}

/** Warna berikutnya yang belum dipakai, supaya campaign baru langsung berbeda. */
export function nextCampaignColor(used: readonly string[]): CampaignColorKey {
  const taken = new Set(used);
  return (
    CAMPAIGN_COLOR_KEYS.find((k) => !taken.has(k)) ??
    CAMPAIGN_COLOR_KEYS[used.length % CAMPAIGN_COLOR_KEYS.length]!
  );
}

export const CAMPAIGN_STATUS_ORDER: RoomCampaignStatus[] = [
  RoomCampaignStatus.PLANNED,
  RoomCampaignStatus.ACTIVE,
  RoomCampaignStatus.PAUSED,
  RoomCampaignStatus.DONE,
];

export const CAMPAIGN_STATUS_LABEL: Record<RoomCampaignStatus, string> = {
  [RoomCampaignStatus.PLANNED]: "Direncanakan",
  [RoomCampaignStatus.ACTIVE]: "Berjalan",
  [RoomCampaignStatus.PAUSED]: "Dijeda",
  [RoomCampaignStatus.DONE]: "Selesai",
};

/**
 * Tekstur pita per status (butuh `--cmp` dari `campaignStyle`):
 * direncanakan = garis putus, berjalan = isi penuh + garis bawah tegas,
 * dijeda = arsir, selesai = pudar.
 */
export const CAMPAIGN_BAND_CLASS: Record<RoomCampaignStatus, string> = {
  [RoomCampaignStatus.PLANNED]:
    "border border-dashed border-[color-mix(in_oklab,var(--cmp)_70%,transparent)] bg-[color-mix(in_oklab,var(--cmp)_9%,transparent)]",
  [RoomCampaignStatus.ACTIVE]:
    "border-b-2 border-[var(--cmp)] bg-[color-mix(in_oklab,var(--cmp)_26%,transparent)]",
  [RoomCampaignStatus.PAUSED]:
    "border border-[color-mix(in_oklab,var(--cmp)_45%,transparent)] bg-[repeating-linear-gradient(135deg,color-mix(in_oklab,var(--cmp)_10%,transparent)_0_5px,color-mix(in_oklab,var(--cmp)_30%,transparent)_5px_7px)]",
  [RoomCampaignStatus.DONE]:
    "bg-[color-mix(in_oklab,var(--cmp)_10%,transparent)] text-muted-foreground",
};

export const OBJECTIVE_ORDER: ContentPlanUsage[] = [
  ContentPlanUsage.AWARENESS,
  ContentPlanUsage.CONSIDERATION,
  ContentPlanUsage.CONVERSION,
];

export const OBJECTIVE_LABEL: Record<ContentPlanUsage, string> = {
  [ContentPlanUsage.AWARENESS]: "Awareness",
  [ContentPlanUsage.CONSIDERATION]: "Consideration",
  [ContentPlanUsage.CONVERSION]: "Conversion",
};

export const OBJECTIVE_HINT: Record<ContentPlanUsage, string> = {
  [ContentPlanUsage.AWARENESS]: "Dikenal lebih banyak orang",
  [ContentPlanUsage.CONSIDERATION]: "Dipertimbangkan dan dicoba",
  [ContentPlanUsage.CONVERSION]: "Penjualan dan transaksi",
};

export const CAMPAIGN_CHANNEL_KEYS = [
  "instagram",
  "tiktok",
  "tiktok_shop",
  "shopee",
  "tokopedia",
  "lazada",
  "website",
  "whatsapp",
  "youtube",
  "facebook",
  "x",
  "email",
  "ads",
  "offline",
] as const;

export type CampaignChannelKey = (typeof CAMPAIGN_CHANNEL_KEYS)[number];

export const CAMPAIGN_CHANNEL_LABEL: Record<CampaignChannelKey, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  tiktok_shop: "TikTok Shop",
  shopee: "Shopee",
  tokopedia: "Tokopedia",
  lazada: "Lazada",
  website: "Website",
  whatsapp: "WhatsApp",
  youtube: "YouTube",
  facebook: "Facebook",
  x: "X",
  email: "Email",
  ads: "Iklan berbayar",
  offline: "Toko & offline",
};

export function isCampaignChannelKey(value: string): value is CampaignChannelKey {
  return (CAMPAIGN_CHANNEL_KEYS as readonly string[]).includes(value);
}

export const EVENT_KIND_ORDER: RoomCalendarEventKind[] = [
  RoomCalendarEventKind.GENERAL,
  RoomCalendarEventKind.SHOOT,
  RoomCalendarEventKind.CONTENT,
  RoomCalendarEventKind.LIVE,
  RoomCalendarEventKind.PROMO,
  RoomCalendarEventKind.KOL,
  RoomCalendarEventKind.LAUNCH,
  RoomCalendarEventKind.OFFLINE,
  RoomCalendarEventKind.MEETING,
  RoomCalendarEventKind.DEADLINE,
];

export const EVENT_KIND_LABEL: Record<RoomCalendarEventKind, string> = {
  [RoomCalendarEventKind.GENERAL]: "Umum",
  [RoomCalendarEventKind.SHOOT]: "Produksi",
  [RoomCalendarEventKind.CONTENT]: "Posting",
  [RoomCalendarEventKind.LIVE]: "Live",
  [RoomCalendarEventKind.PROMO]: "Promo",
  [RoomCalendarEventKind.KOL]: "KOL",
  [RoomCalendarEventKind.LAUNCH]: "Launching",
  [RoomCalendarEventKind.OFFLINE]: "Event offline",
  [RoomCalendarEventKind.MEETING]: "Rapat",
  [RoomCalendarEventKind.DEADLINE]: "Tenggat",
};

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatRupiah(value: number): string {
  return rupiah.format(value);
}

/** Ringkas untuk ruang sempit: "Rp 12,5 jt", "Rp 1,2 M". */
export function formatRupiahCompact(value: number): string {
  const abs = Math.abs(value);
  const trim = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 1 });
  if (abs >= 1_000_000_000) return `Rp ${trim(value / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `Rp ${trim(value / 1_000_000)} jt`;
  if (abs >= 1_000) return `Rp ${trim(value / 1_000)} rb`;
  return formatRupiah(value);
}
