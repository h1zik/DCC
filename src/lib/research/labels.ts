import {
  KeywordIntelStatus,
  ProductConceptMode,
  ProductConceptStatus,
  ProductDiscoveryStatus,
  ResearchMarketplace,
  ResearchReportStatus,
  ResearchReportType,
  ReviewIntelSourceStatus,
  SocialListeningPlatform,
  SocialListeningStatus,
  SocialMentionClass,
  TrendDimension,
  TrendPhase,
  TrendRadarStatus,
  UspGapStatus,
} from "@prisma/client";

export const MARKETPLACE_LABELS: Record<ResearchMarketplace, string> = {
  SHOPEE: "Shopee",
  TOKOPEDIA: "Tokopedia",
  LAZADA: "Lazada",
  TIKTOK_SHOP: "TikTok Shop",
  FEMALEDAILY: "Female Daily",
  SOCIOLLA: "Sociolla",
};

export const SOURCE_STATUS_LABELS: Record<ReviewIntelSourceStatus, string> = {
  PENDING: "Menunggu",
  SCRAPING: "Scraping",
  ANALYZING: "Menganalisis",
  READY: "Siap",
  FAILED: "Gagal",
};

export const PRODUCT_DISCOVERY_STATUS_LABELS: Record<
  ProductDiscoveryStatus,
  string
> = {
  PENDING: "Menunggu",
  SCRAPING: "Mengambil produk",
  READY: "Siap",
  FAILED: "Gagal",
};

export const KEYWORD_INTEL_STATUS_LABELS: Record<KeywordIntelStatus, string> = {
  PENDING: "Menunggu",
  COLLECTING: "Mengumpulkan",
  ANALYZING: "Menganalisis",
  READY: "Siap",
  FAILED: "Gagal",
};

export const TREND_RADAR_STATUS_LABELS: Record<TrendRadarStatus, string> = {
  PENDING: "Menunggu",
  COLLECTING: "Mengumpulkan",
  ANALYZING: "Menganalisis",
  READY: "Siap",
  FAILED: "Gagal",
};

export const TREND_PHASE_LABELS: Record<TrendPhase, string> = {
  EMERGING: "Emerging",
  GROWING: "Growing",
  PEAK: "Peak",
  DECLINING: "Declining",
};

export const TREND_DIMENSION_LABELS: Record<TrendDimension, string> = {
  INGREDIENT: "Bahan",
  CLAIM: "Klaim",
  CATEGORY: "Kategori",
  FORMAT: "Format",
  BRAND: "Brand",
};

export const SOCIAL_LISTENING_STATUS_LABELS: Record<
  SocialListeningStatus,
  string
> = {
  PENDING: "Menunggu",
  COLLECTING: "Mengumpulkan",
  ANALYZING: "Menganalisis",
  READY: "Siap",
  FAILED: "Gagal",
};

export const SOCIAL_LISTENING_PLATFORM_LABELS: Record<
  SocialListeningPlatform,
  string
> = {
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
};

export const SOCIAL_MENTION_CLASS_LABELS: Record<SocialMentionClass, string> = {
  COMPLAINT: "Keluhan",
  PRAISE: "Pujian",
  QUESTION: "Pertanyaan",
  WISHLIST: "Wishlist",
  RECOMMENDATION: "Rekomendasi",
  NEUTRAL: "Netral",
};

export const USP_GAP_STATUS_LABELS: Record<UspGapStatus, string> = {
  PENDING: "Menunggu",
  GATHERING: "Mengumpulkan",
  ANALYZING: "Menganalisis",
  READY: "Siap",
  FAILED: "Gagal",
};

export const PRODUCT_CONCEPT_MODE_LABELS: Record<ProductConceptMode, string> = {
  MANUAL: "Manual",
  AI_GENERATED: "AI Generate",
};

export const PRODUCT_CONCEPT_STATUS_LABELS: Record<
  ProductConceptStatus,
  string
> = {
  DRAFT: "Draft",
  VALIDATING: "Validasi",
  READY: "Siap",
  SENT_TO_RND: "Dikirim ke R&D",
  ARCHIVED: "Arsip",
};

export const RESEARCH_REPORT_TYPE_LABELS: Record<ResearchReportType, string> = {
  WEEKLY: "Mingguan",
  CUSTOM: "Custom",
  CATEGORY_DEEP_DIVE: "Category Deep Dive",
  COMPETITOR_BATTLE: "Competitor Battle",
  TREND_BRIEF: "Trend Brief",
};

export const RESEARCH_REPORT_STATUS_LABELS: Record<
  ResearchReportStatus,
  string
> = {
  PENDING: "Menunggu",
  GENERATING: "Membuat",
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
