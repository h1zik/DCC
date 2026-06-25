import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import { UserRole } from "@prisma/client";
import {
  aiAnalyzeCompetitorPricing,
  aiEvaluateProductProposal,
  aiGetCompetitorProductCategory,
  aiGetKeywordQuery,
  aiGetProductConcept,
  aiGetProductDiscoveryQuery,
  aiGetResearchCompetitor,
  aiGetResearchDashboard,
  aiGetResearchReport,
  aiGetReviewIntelSource,
  aiGetSocialMonitor,
  aiGetTrendDigest,
  aiGetUspAnalysis,
  aiListKeywordQueries,
  aiListProductConcepts,
  aiListCompetitorProductCategories,
  aiListProductDiscoveryQueries,
  aiListResearchCompetitors,
  aiListResearchRecommendations,
  aiListResearchReports,
  aiListReviewIntelSources,
  aiListSocialMonitors,
  aiListTrendDigests,
  aiListUspAnalyses,
  aiSearchCompetitorProducts,
} from "@/lib/ai-api/research-queries";
import { canViewResearchHub } from "@/lib/ai-api/auth";
import type { AgentToolResult, AgentUser } from "./types";

export const RESEARCH_AGENT_TOOL_NAMES = new Set([
  "evaluate_product_with_research",
  "analyze_competitor_pricing",
  "get_research_hub_dashboard",
  "list_research_recommendations",
  "list_research_competitors",
  "get_research_competitor",
  "list_competitor_product_categories",
  "get_competitor_product_category",
  "search_competitor_products",
  "list_review_intel_sources",
  "get_review_intel_source",
  "list_trend_digests",
  "get_trend_digest",
  "list_keyword_intel_queries",
  "get_keyword_intel_query",
  "list_social_listening_monitors",
  "get_social_listening_monitor",
  "list_usp_gap_analyses",
  "get_usp_gap_analysis",
  "list_product_concepts",
  "get_product_concept",
  "list_product_discovery_queries",
  "get_product_discovery_query",
  "list_research_reports",
  "get_research_report",
]);

export const RESEARCH_AGENT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "evaluate_product_with_research",
    description:
      "UTAMA untuk validasi ide produk/harga/launch: 'apakah make sense jual X di harga Y dengan claim Z?'. Otomatis memindai Competitor Tracker (harga SKU), Product Discovery (landscape marketplace scrape), Review Intel (keluhan/gap), Trend Radar, Keyword Intel, USP Analyzer, Social Listening, rekomendasi riset — lalu siapkan bahan analisis. WAJIB dipanggil untuk pertanyaan kelayakan produk/harga/positioning.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productQuery: {
          type: SchemaType.STRING,
          description: "Kategori/produk, mis. 'body lotion'",
        },
        proposedPrice: {
          type: SchemaType.NUMBER,
          description: "Harga jual yang diusulkan dalam IDR, mis. 39000 untuk Rp39rb",
        },
        claims: {
          type: SchemaType.STRING,
          description: "Claim/komposisi, mis. 'instant whitening'",
        },
        sizeMl: {
          type: SchemaType.NUMBER,
          description: "Ukuran volume ml, mis. 250",
        },
        packagingNotes: {
          type: SchemaType.STRING,
          description: "Catatan kemasan, mis. 'stiker design'",
        },
      },
      required: ["productQuery"],
    },
  },
  {
    name: "analyze_competitor_pricing",
    description:
      "UTAMA untuk perbandingan harga kompetitor & produk serupa. Mengambil harga per SKU (currentPrice IDR), min/max/avg, promo, rating. Filter by productQuery mis. 'body lotion'. Juga mencocokkan Review Intel & katalog internal. Panggil tool ini dulu untuk pertanyaan harga/banding harga — jangan hanya list_research_competitors.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productQuery: {
          type: SchemaType.STRING,
          description:
            "Kata kunci produk/kategori, mis. 'body lotion', 'hand cream'. Kosongkan untuk semua kompetitor aktif.",
        },
        competitorId: {
          type: SchemaType.STRING,
          description: "Opsional: batasi ke satu kompetitor by ID",
        },
        activeOnly: {
          type: SchemaType.BOOLEAN,
          description: "Default true — hanya kompetitor aktif",
        },
        limit: {
          type: SchemaType.NUMBER,
          description: "Maks SKU per kompetitor (default 50)",
        },
      },
    },
  },
  {
    name: "get_research_hub_dashboard",
    description:
      "Command center Research Hub: KPI modul, alert kompetitor/tren, health data source, rekomendasi, laporan terbaru.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: "list_research_recommendations",
    description: "Rekomendasi aksi preskriptif lintas modul Research Hub.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: { type: SchemaType.NUMBER, description: "Maks baris (opsional)" },
      },
    },
  },
  {
    name: "list_research_competitors",
    description:
      "Daftar kompetitor di Competitor Tracker (termasuk ringkasan min/max/avg harga). Untuk perbandingan harga detail pakai analyze_competitor_pricing.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: { type: SchemaType.NUMBER, description: "Maks baris (opsional)" },
      },
    },
  },
  {
    name: "get_research_competitor",
    description: "Detail kompetitor: SKU, harga, alert, snapshot, AI insights.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        competitorId: {
          type: SchemaType.STRING,
          description: "ID kompetitor dari Research Hub",
        },
      },
      required: ["competitorId"],
    },
  },
  {
    name: "list_competitor_product_categories",
    description:
      "Daftar kategori Competitor Products — tracker produk kompetitor level-PRODUK (per item, bukan per toko). Tiap kategori berisi ringkasan jumlah produk terlacak, ringkasan harga (min/max/avg), dan jumlah alert. WAJIB panggil ini dulu untuk dapat `id` kategori sebelum get_competitor_product_category. Catatan: ini BERBEDA dari list_research_competitors (yang level-toko).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: { type: SchemaType.NUMBER, description: "Maks baris (opsional)" },
      },
    },
  },
  {
    name: "get_competitor_product_category",
    description:
      "Detail satu kategori Competitor Products: semua produk terlacak (nama, brand, marketplace, harga IDR, rating, jumlah review, terjual, estimasi revenue, stok, promo), ringkasan harga, dan alert harga/stok. categoryId = field `id` dari list_competitor_product_categories.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        categoryId: {
          type: SchemaType.STRING,
          description:
            "ID kategori (CUID) dari list_competitor_product_categories.items[].id",
        },
      },
      required: ["categoryId"],
    },
  },
  {
    name: "search_competitor_products",
    description:
      "Cari produk kompetitor terlacak by nama/brand lintas semua kategori Competitor Products. Mengembalikan harga IDR, rating, review, terjual, promo + ringkasan harga (min/max/avg) hasil pencarian. Pakai untuk pertanyaan seperti 'produk kompetitor X yang saya track', 'harga produk kompetitor brand Y'. Kosongkan query untuk produk terlacak terbaru.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: {
          type: SchemaType.STRING,
          description:
            "Kata kunci nama/brand produk, mis. 'serum', 'Wardah'. Kosongkan untuk semua produk aktif.",
        },
        limit: { type: SchemaType.NUMBER, description: "Maks produk (default 30)" },
      },
    },
  },
  {
    name: "list_review_intel_sources",
    description: "Daftar sumber Review Intelligence (produk kompetitor).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: { type: SchemaType.NUMBER, description: "Maks baris (opsional)" },
      },
    },
  },
  {
    name: "get_review_intel_source",
    description:
      "Detail review intelligence: sentimen, keluhan/pujian, gap opportunity, sample review.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        sourceId: {
          type: SchemaType.STRING,
          description: "ID sumber review intelligence",
        },
      },
      required: ["sourceId"],
    },
  },
  {
    name: "list_trend_digests",
    description: "Daftar digest Trend Radar mingguan.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: { type: SchemaType.NUMBER, description: "Maks baris (opsional)" },
      },
    },
  },
  {
    name: "get_trend_digest",
    description: "Detail digest tren: narasi, item per fase, action plan.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        digestId: {
          type: SchemaType.STRING,
          description: "ID digest trend radar",
        },
      },
      required: ["digestId"],
    },
  },
  {
    name: "list_keyword_intel_queries",
    description: "Daftar analisis Keyword Intel.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: { type: SchemaType.NUMBER, description: "Maks baris (opsional)" },
      },
    },
  },
  {
    name: "get_keyword_intel_query",
    description: "Detail keyword intel: matrix, gap keywords, copy suggestions.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        queryId: {
          type: SchemaType.STRING,
          description: "ID query keyword intel / product discovery",
        },
      },
      required: ["queryId"],
    },
  },
  {
    name: "list_social_listening_monitors",
    description: "Daftar monitor Social Listening (TikTok/Instagram).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: { type: SchemaType.NUMBER, description: "Maks baris (opsional)" },
      },
    },
  },
  {
    name: "get_social_listening_monitor",
    description:
      "Detail social listening: pain points, wishlist, viral content, top mentions.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        monitorId: {
          type: SchemaType.STRING,
          description: "ID monitor social listening",
        },
      },
      required: ["monitorId"],
    },
  },
  {
    name: "list_usp_gap_analyses",
    description: "Daftar analisis USP & Gap positioning per kategori.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: { type: SchemaType.NUMBER, description: "Maks baris (opsional)" },
      },
    },
  },
  {
    name: "get_usp_gap_analysis",
    description: "Detail USP analyzer: gap matrix, positioning, USP candidates.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        analysisId: {
          type: SchemaType.STRING,
          description: "ID analisis USP gap",
        },
      },
      required: ["analysisId"],
    },
  },
  {
    name: "list_product_concepts",
    description: "Daftar konsep produk di Concept Lab.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: { type: SchemaType.NUMBER, description: "Maks baris (opsional)" },
      },
    },
  },
  {
    name: "get_product_concept",
    description: "Detail konsep produk: data konsep, skor validasi, risk factors.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        conceptId: {
          type: SchemaType.STRING,
          description: "ID konsep produk",
        },
      },
      required: ["conceptId"],
    },
  },
  {
    name: "list_product_discovery_queries",
    description:
      "Daftar query Product Discovery marketplace. WAJIB panggil ini dulu sebelum get_product_discovery_query — ambil field `id` dari items.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: { type: SchemaType.NUMBER, description: "Maks baris (opsional)" },
      },
    },
  },
  {
    name: "get_product_discovery_query",
    description:
      "Detail product discovery: produk teratas, AI insights. queryId = field `id` dari list_product_discovery_queries (bukan nama keyword).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        queryId: {
          type: SchemaType.STRING,
          description:
            "ID query (CUID) dari list_product_discovery_queries.items[].id",
        },
      },
      required: ["queryId"],
    },
  },
  {
    name: "list_research_reports",
    description: "Daftar laporan riset (weekly, custom, deep dive).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: { type: SchemaType.NUMBER, description: "Maks baris (opsional)" },
      },
    },
  },
  {
    name: "get_research_report",
    description: "Detail laporan riset lengkap: sections, summary, action items.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        reportId: {
          type: SchemaType.STRING,
          description: "ID laporan riset",
        },
      },
      required: ["reportId"],
    },
  },
];

function parseLimit(raw: unknown, fallback: number, max = 50): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 1) {
    return fallback;
  }
  return Math.min(Math.floor(raw), max);
}

function unwrapResearchResult(result: {
  accessible: boolean;
  message?: string;
  data?: unknown;
  found?: boolean;
  count?: number;
  items?: unknown;
}) {
  if (!result.accessible) {
    throw new Error(result.message ?? "Akses Research Hub ditolak.");
  }
  if ("found" in result && result.found === false) {
    throw new Error("Data Research Hub tidak ditemukan.");
  }
  if ("data" in result && result.data !== undefined) {
    return result.data;
  }
  if ("items" in result) {
    return { count: result.count, items: result.items };
  }
  return result;
}

export function canAgentUseResearchTools(user: AgentUser): boolean {
  return canViewResearchHub(user.role as UserRole);
}

export async function executeAgentResearchTool(
  user: AgentUser,
  name: string,
  args: Record<string, unknown>,
): Promise<AgentToolResult | null> {
  if (!RESEARCH_AGENT_TOOL_NAMES.has(name)) return null;

  if (!canAgentUseResearchTools(user)) {
    return {
      ok: false,
      error:
        "Research Hub hanya untuk Market Analyst, CEO, atau Administrator.",
    };
  }

  const role = user.role as UserRole;
  const limit = (fb: number, max?: number) =>
    parseLimit(args.limit, fb, max);

  try {
    let data: unknown;

    switch (name) {
      case "evaluate_product_with_research": {
        const rawPrice = args.proposedPrice;
        let proposedPrice: number | undefined;
        if (typeof rawPrice === "number" && Number.isFinite(rawPrice)) {
          proposedPrice = rawPrice;
        } else if (typeof rawPrice === "string") {
          const n = Number(String(rawPrice).replace(/[^\d]/g, ""));
          if (Number.isFinite(n) && n > 0) proposedPrice = n;
        }
        data = unwrapResearchResult(
          await aiEvaluateProductProposal(role, {
            productQuery: String(args.productQuery),
            proposedPrice,
            claims: args.claims ? String(args.claims) : undefined,
            sizeMl:
              typeof args.sizeMl === "number" ? args.sizeMl : undefined,
            packagingNotes: args.packagingNotes
              ? String(args.packagingNotes)
              : undefined,
          }),
        );
        break;
      }
      case "analyze_competitor_pricing":
        data = unwrapResearchResult(
          await aiAnalyzeCompetitorPricing(role, {
            productQuery: args.productQuery
              ? String(args.productQuery)
              : undefined,
            competitorId: args.competitorId
              ? String(args.competitorId)
              : undefined,
            activeOnly: args.activeOnly !== false,
            limit: limit(50, 80),
          }),
        );
        break;
      case "get_research_hub_dashboard":
        data = unwrapResearchResult(await aiGetResearchDashboard(role));
        break;
      case "list_research_recommendations":
        data = unwrapResearchResult(
          await aiListResearchRecommendations(role, limit(30)),
        );
        break;
      case "list_research_competitors":
        data = unwrapResearchResult(
          await aiListResearchCompetitors(role, limit(40)),
        );
        break;
      case "get_research_competitor":
        data = unwrapResearchResult(
          await aiGetResearchCompetitor(role, String(args.competitorId)),
        );
        break;
      case "list_competitor_product_categories":
        data = unwrapResearchResult(
          await aiListCompetitorProductCategories(role, limit(40)),
        );
        break;
      case "get_competitor_product_category":
        data = unwrapResearchResult(
          await aiGetCompetitorProductCategory(
            role,
            String(args.categoryId),
          ),
        );
        break;
      case "search_competitor_products":
        data = unwrapResearchResult(
          await aiSearchCompetitorProducts(
            role,
            args.query ? String(args.query) : "",
            limit(30, 50),
          ),
        );
        break;
      case "list_review_intel_sources":
        data = unwrapResearchResult(
          await aiListReviewIntelSources(role, limit(40)),
        );
        break;
      case "get_review_intel_source":
        data = unwrapResearchResult(
          await aiGetReviewIntelSource(role, String(args.sourceId)),
        );
        break;
      case "list_trend_digests":
        data = unwrapResearchResult(await aiListTrendDigests(role, limit(20, 30)));
        break;
      case "get_trend_digest":
        data = unwrapResearchResult(
          await aiGetTrendDigest(role, String(args.digestId)),
        );
        break;
      case "list_keyword_intel_queries":
        data = unwrapResearchResult(
          await aiListKeywordQueries(role, limit(30)),
        );
        break;
      case "get_keyword_intel_query":
        data = unwrapResearchResult(
          await aiGetKeywordQuery(role, String(args.queryId)),
        );
        break;
      case "list_social_listening_monitors":
        data = unwrapResearchResult(
          await aiListSocialMonitors(role, limit(30)),
        );
        break;
      case "get_social_listening_monitor":
        data = unwrapResearchResult(
          await aiGetSocialMonitor(role, String(args.monitorId)),
        );
        break;
      case "list_usp_gap_analyses":
        data = unwrapResearchResult(await aiListUspAnalyses(role, limit(30)));
        break;
      case "get_usp_gap_analysis":
        data = unwrapResearchResult(
          await aiGetUspAnalysis(role, String(args.analysisId)),
        );
        break;
      case "list_product_concepts":
        data = unwrapResearchResult(
          await aiListProductConcepts(role, limit(40)),
        );
        break;
      case "get_product_concept":
        data = unwrapResearchResult(
          await aiGetProductConcept(role, String(args.conceptId)),
        );
        break;
      case "list_product_discovery_queries":
        data = unwrapResearchResult(
          await aiListProductDiscoveryQueries(role, limit(30)),
        );
        break;
      case "get_product_discovery_query":
        data = unwrapResearchResult(
          await aiGetProductDiscoveryQuery(role, String(args.queryId)),
        );
        break;
      case "list_research_reports":
        data = unwrapResearchResult(
          await aiListResearchReports(role, limit(20, 30)),
        );
        break;
      case "get_research_report":
        data = unwrapResearchResult(
          await aiGetResearchReport(role, String(args.reportId)),
        );
        break;
      default:
        return null;
    }

    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan.",
    };
  }
}
