import "server-only";

import { TrendDimension, TrendPhase } from "@prisma/client";

export type DemoTrendItem = {
  name: string;
  dimension: TrendDimension;
  phase: TrendPhase;
  score: number;
  narrative: string;
  isGlobalPipeline: boolean;
  sources: { type: string; snippet: string; url?: string }[];
  relatedProducts: string[];
};

export function generateDemoTrendItems(): DemoTrendItem[] {
  return [
    {
      name: "Exosome serum",
      dimension: TrendDimension.INGREDIENT,
      phase: TrendPhase.EMERGING,
      score: 0.92,
      narrative:
        "Bahan aktif generasi baru dari K-beauty mulai muncul di produk lokal premium.",
      isGlobalPipeline: true,
      sources: [{ type: "google_trends", snippet: "Rising query +180%" }],
      relatedProducts: ["Exosome Brightening Serum", "Cell Repair Essence"],
    },
    {
      name: "Skin cycling",
      dimension: TrendDimension.CLAIM,
      phase: TrendPhase.EMERGING,
      score: 0.88,
      narrative: "Rutinitas rotasi aktif skincare viral di TikTok Indonesia.",
      isGlobalPipeline: true,
      sources: [{ type: "tiktok", snippet: "#skincycling 12M views" }],
      relatedProducts: [],
    },
    {
      name: "Mugwort extract",
      dimension: TrendDimension.INGREDIENT,
      phase: TrendPhase.EMERGING,
      score: 0.85,
      narrative: "Ekstrak herbal K-beauty untuk kulit sensitif dan acne-prone.",
      isGlobalPipeline: true,
      sources: [{ type: "rss", snippet: "K-beauty ingredient spotlight" }],
      relatedProducts: ["Mugwort Calming Toner"],
    },
    {
      name: "Sunscreen tint",
      dimension: TrendDimension.FORMAT,
      phase: TrendPhase.GROWING,
      score: 0.79,
      narrative: "Hybrid sunscreen + base makeup untuk kulit Indonesia.",
      isGlobalPipeline: false,
      sources: [{ type: "marketplace", snippet: "Search volume naik 45%" }],
      relatedProducts: ["Tinted UV Shield SPF50", "Glow Tint Sunscreen"],
    },
    {
      name: "Ceramide barrier",
      dimension: TrendDimension.CLAIM,
      phase: TrendPhase.GROWING,
      score: 0.76,
      narrative: "Klaim barrier repair mendominasi kategori moisturizer.",
      isGlobalPipeline: false,
      sources: [{ type: "google_trends", snippet: "Stable growth 3 bulan" }],
      relatedProducts: ["Ceramide Barrier Cream", "Skin Barrier Serum"],
    },
    {
      name: "Fragrance-free skincare",
      dimension: TrendDimension.CLAIM,
      phase: TrendPhase.GROWING,
      score: 0.74,
      narrative: "Permintaan produk tanpa parfum untuk kulit sensitif meningkat.",
      isGlobalPipeline: false,
      sources: [{ type: "review_intel", snippet: "Keluhan aroma dominan" }],
      relatedProducts: [],
    },
    {
      name: "Glass skin",
      dimension: TrendDimension.CLAIM,
      phase: TrendPhase.PEAK,
      score: 0.65,
      narrative: "Klaim glow/halus masih populer tapi mendekati saturasi.",
      isGlobalPipeline: true,
      sources: [{ type: "google_trends", snippet: "Peak interest" }],
      relatedProducts: ["Glass Skin Essence"],
    },
    {
      name: "Niacinamide serum",
      dimension: TrendDimension.INGREDIENT,
      phase: TrendPhase.PEAK,
      score: 0.62,
      narrative: "Kategori sudah ramai dengan 100+ SKU di marketplace.",
      isGlobalPipeline: false,
      sources: [{ type: "competitor", snippet: "High SKU density" }],
      relatedProducts: ["Niacinamide 10% Serum"],
    },
    {
      name: "Micellar water",
      dimension: TrendDimension.FORMAT,
      phase: TrendPhase.PEAK,
      score: 0.58,
      narrative: "Format cleanser klasik, pertumbuhan melambat.",
      isGlobalPipeline: false,
      sources: [{ type: "google_trends", snippet: "Flat trend" }],
      relatedProducts: [],
    },
    {
      name: "Clay mask",
      dimension: TrendDimension.FORMAT,
      phase: TrendPhase.DECLINING,
      score: 0.35,
      narrative: "Interes menurun, digantikan format wash-off dan peel-off baru.",
      isGlobalPipeline: false,
      sources: [{ type: "google_trends", snippet: "Declining -22%" }],
      relatedProducts: [],
    },
    {
      name: "Heavy foundation",
      dimension: TrendDimension.FORMAT,
      phase: TrendPhase.DECLINING,
      score: 0.32,
      narrative: "Shift ke skin tint dan cushion ringan.",
      isGlobalPipeline: true,
      sources: [{ type: "rss", snippet: "Lightweight base trend" }],
      relatedProducts: [],
    },
    {
      name: "Alcohol toner",
      dimension: TrendDimension.FORMAT,
      phase: TrendPhase.DECLINING,
      score: 0.28,
      narrative: "Konsumen menghindari alkohol, beralih ke hydrating toner.",
      isGlobalPipeline: false,
      sources: [{ type: "review_intel", snippet: "Keluhan iritasi" }],
      relatedProducts: [],
    },
  ];
}
