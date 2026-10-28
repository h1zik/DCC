import "server-only";

import { Prisma, ResearchMarketplace, SeoAnalysisStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isScraperApiConfigured } from "@/lib/scraper-api/client";
import { fetchShopeeSearchViaVps } from "@/lib/scraper-api/shopee-products";
import { fetchTokopediaSearchViaVps } from "@/lib/scraper-api/tokopedia-products";
import { fetchLazadaSearchViaVps } from "@/lib/scraper-api/lazada-products";
import type { NormalizedShopProduct } from "@/lib/apify/normalize";
import {
  analyzeListings,
  scoreOwnTitle,
  type MarketplaceListing,
} from "@/lib/seo/marketplace/marketplace-rules";
import {
  buildResearchAiStep,
  generateResearchJson,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";

const MAX_ITEMS = 40;

/** Pesan FAILED saat scraper mengembalikan 0 listing (anti-bot/cooldown). */
export const EMPTY_SCRAPE_MESSAGE =
  "Scraper tidak mengembalikan listing — kemungkinan diblokir (anti-bot) atau cooldown. Coba lagi beberapa menit.";

/** Notice saat rekomendasi LLM gagal (analisis tetap READY). */
export const LLM_FAILED_NOTICE = "Rekomendasi AI gagal dibuat.";

/** Marketplace yang didukung Marketplace SEO (punya data harga/terjual andal). */
export const MARKETPLACE_SEO_SUPPORTED: ResearchMarketplace[] = [
  ResearchMarketplace.SHOPEE,
  ResearchMarketplace.TOKOPEDIA,
  ResearchMarketplace.LAZADA,
];

async function searchMarketplace(
  marketplace: ResearchMarketplace,
  keyword: string,
): Promise<NormalizedShopProduct[]> {
  switch (marketplace) {
    case ResearchMarketplace.SHOPEE:
      return fetchShopeeSearchViaVps(keyword, MAX_ITEMS);
    case ResearchMarketplace.TOKOPEDIA:
      return fetchTokopediaSearchViaVps(keyword, MAX_ITEMS);
    case ResearchMarketplace.LAZADA:
      return fetchLazadaSearchViaVps(keyword, MAX_ITEMS);
    default:
      throw new Error("Marketplace tidak didukung untuk analisis SEO.");
  }
}

export async function runMarketplaceAnalysis(analysisId: string): Promise<void> {
  const analysis = await prisma.seoMarketplaceAnalysis.findUnique({
    where: { id: analysisId },
  });
  if (!analysis) throw new Error("Analisis tidak ditemukan.");

  if (!isScraperApiConfigured()) {
    await prisma.seoMarketplaceAnalysis.update({
      where: { id: analysisId },
      data: {
        status: SeoAnalysisStatus.FAILED,
        errorMessage:
          "Scraper VPS belum dikonfigurasi (set SCRAPER_API_URL & SCRAPER_API_KEY).",
      },
    });
    return;
  }

  await prisma.seoMarketplaceAnalysis.update({
    where: { id: analysisId },
    data: { status: SeoAnalysisStatus.COLLECTING, errorMessage: null, dataNotice: null },
  });

  try {
    const products = await searchMarketplace(analysis.marketplace, analysis.keyword);

    if (products.length === 0) {
      // Hasil kosong hampir selalu berarti scraper diblokir (anti-bot Shopee)
      // atau VPS sedang cooldown — bukan "tidak ada listing". Scraper tidak
      // mengekspos status/error run saat hasil kosong (run failed sudah throw),
      // jadi tandai FAILED agar bisa diulang, bukan READY kosong.
      await prisma.seoMarketplaceAnalysis.update({
        where: { id: analysisId },
        data: {
          status: SeoAnalysisStatus.FAILED,
          errorMessage: EMPTY_SCRAPE_MESSAGE,
          dataNotice: null,
        },
      });
      return;
    }

    await prisma.seoMarketplaceAnalysis.update({
      where: { id: analysisId },
      data: { status: SeoAnalysisStatus.ANALYZING },
    });

    const listings: MarketplaceListing[] = products.map((p) => ({
      name: p.name,
      price: p.price,
      soldCount: p.soldCount,
      rating: p.rating,
      reviewCount: p.reviewCount,
      isOfficialShop: p.isOfficialShop,
    }));

    const { stats, topTitleTerms } = analyzeListings(listings);
    const titleScore = analysis.ownTitle
      ? scoreOwnTitle(
          analysis.ownTitle,
          analysis.keyword,
          topTitleTerms,
          stats.avgTitleLength,
        )
      : null;

    const recommendations = await generateRecommendations(
      analysis.keyword,
      analysis.marketplace,
      stats,
      topTitleTerms,
      analysis.ownTitle,
      titleScore,
    );

    const topListings = products
      .slice()
      .sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0))
      .slice(0, 12)
      .map((p) => ({
        name: p.name,
        price: p.price,
        soldCount: p.soldCount,
        rating: p.rating,
        isOfficialShop: p.isOfficialShop,
      }));

    await prisma.seoMarketplaceAnalysis.update({
      where: { id: analysisId },
      data: {
        status: SeoAnalysisStatus.READY,
        listingStats: stats as unknown as Prisma.InputJsonValue,
        titlePatterns: topTitleTerms as unknown as Prisma.InputJsonValue,
        topListings: topListings as unknown as Prisma.InputJsonValue,
        optimizationScore: titleScore?.score ?? null,
        recommendations: recommendations
          ? (recommendations as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        aiMeta: recommendations?.usedLlm
          ? (researchAiMetaFromSteps([
              buildResearchAiStep("Marketplace SEO recommendations", "flash"),
            ]) as object)
          : undefined,
        dataNotice: recommendations.llmFailed ? LLM_FAILED_NOTICE : null,
        errorMessage: null,
      },
    });
  } catch (err) {
    await prisma.seoMarketplaceAnalysis.update({
      where: { id: analysisId },
      data: {
        status: SeoAnalysisStatus.FAILED,
        errorMessage: err instanceof Error ? err.message : "Analisis marketplace gagal.",
      },
    });
    throw err;
  }
}

export async function enqueueMarketplaceAnalysis(analysisId: string): Promise<void> {
  await runMarketplaceAnalysis(analysisId);
}

async function generateRecommendations(
  keyword: string,
  marketplace: ResearchMarketplace,
  stats: ReturnType<typeof analyzeListings>["stats"],
  topTerms: { term: string; count: number }[],
  ownTitle: string | null,
  titleScore: ReturnType<typeof scoreOwnTitle> | null,
) {
  // Netral: analisis tidak punya field kategori, jadi jangan asumsikan
  // kosmetik/skincare — biarkan LLM menyimpulkan kategori dari keyword & istilah.
  const prompt = `Kamu adalah spesialis marketplace SEO (${marketplace}) untuk produk di marketplace Indonesia. Simpulkan kategori produk dari keyword dan istilah judul.
Keyword: "${keyword}".
Statistik listing teratas: ${JSON.stringify(stats)}.
Istilah judul tersering: ${topTerms.map((t) => `${t.term}(${t.count})`).join(", ")}.
${ownTitle ? `Judul produk saya: "${ownTitle}" (skor heuristik ${titleScore?.score}/100, istilah pesaing yang belum ada: ${titleScore?.missingTerms.join(", ") || "-"}).` : "Belum ada judul produk sendiri."}

Tugas:
1. Beri 3-6 rekomendasi optimasi judul/tag yang konkret (Bahasa Indonesia).
${ownTitle ? "2. Usulkan satu judul produk yang lebih optimal (sertakan keyword + istilah penting + tetap natural, maks 120 karakter)." : ""}

Balas HANYA JSON valid:
{ "recommendations": ["string"]${ownTitle ? ', "improvedTitle": "string"' : ""} }`;

  try {
    const result = await generateResearchJson<{
      recommendations?: string[];
      improvedTitle?: string;
    }>(prompt, { tier: "flash", validate: (r) => Array.isArray(r.recommendations) });
    return {
      titleScore,
      recommendations: Array.isArray(result.recommendations)
        ? result.recommendations.map((r) => String(r).trim()).filter(Boolean)
        : [],
      improvedTitle: result.improvedTitle?.trim() || null,
      usedLlm: true as const,
      llmFailed: false as const,
    };
  } catch (err) {
    console.warn("[seo/marketplace] rekomendasi LLM gagal", err);
    return {
      titleScore,
      recommendations: [],
      improvedTitle: null,
      usedLlm: false as const,
      llmFailed: true as const,
    };
  }
}
