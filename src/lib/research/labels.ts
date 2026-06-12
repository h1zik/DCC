import {
  ResearchMarketplace,
  ReviewIntelSourceStatus,
} from "@prisma/client";

export const MARKETPLACE_LABELS: Record<ResearchMarketplace, string> = {
  SHOPEE: "Shopee",
  TOKOPEDIA: "Tokopedia",
  TIKTOK_SHOP: "TikTok Shop",
};

export const SOURCE_STATUS_LABELS: Record<ReviewIntelSourceStatus, string> = {
  PENDING: "Menunggu",
  SCRAPING: "Scraping",
  ANALYZING: "Menganalisis",
  READY: "Siap",
  FAILED: "Gagal",
};

export function formatRp(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatRelativeTime(date: Date | null | undefined): string {
  if (!date) return "—";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}
