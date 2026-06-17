import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

type Deps = {
  dccFetch: (path: string) => Promise<unknown>;
  buildQuery: (params: Record<string, string | number | boolean | undefined>) => string;
  asText: (data: unknown) => {
    content: { type: "text"; text: string }[];
  };
  limitSchema: z.ZodOptional<z.ZodNumber>;
};

const idSchema = z.string().min(1).describe("ID record dari DCC Research Hub");

export function registerResearchTools(server: McpServer, deps: Deps) {
  const { dccFetch, buildQuery, asText, limitSchema } = deps;

  server.tool(
    "get_research_hub_dashboard",
    "Command center Research Hub: KPI modul, alert kompetitor/tren, health data source, rekomendasi preskriptif, laporan terbaru.",
    {},
    async () => asText(await dccFetch("/api/ai/research/dashboard")),
  );

  server.tool(
    "list_research_recommendations",
    "Rekomendasi aksi preskriptif lintas modul Research Hub (prioritas, owner, confidence).",
    { limit: limitSchema.describe("Default 30, maks 50") },
    async ({ limit }) =>
      asText(
        await dccFetch(`/api/ai/research/recommendations${buildQuery({ limit })}`),
      ),
  );

  server.tool(
    "list_research_competitors",
    "Daftar kompetitor aktif di Competitor Tracker beserta jumlah SKU dan alert.",
    { limit: limitSchema.describe("Default 40, maks 50") },
    async ({ limit }) =>
      asText(
        await dccFetch(`/api/ai/research/competitors${buildQuery({ limit })}`),
      ),
  );

  server.tool(
    "get_research_competitor",
    "Detail kompetitor: SKU, harga, rating, alert, snapshot harga terbaru, AI insights.",
    { competitorId: idSchema },
    async ({ competitorId }) =>
      asText(
        await dccFetch(
          `/api/ai/research/competitors/${encodeURIComponent(competitorId)}`,
        ),
      ),
  );

  server.tool(
    "list_review_intel_sources",
    "Daftar sumber Review Intelligence (produk kompetitor yang di-scrape).",
    { limit: limitSchema.describe("Default 40, maks 50") },
    async ({ limit }) =>
      asText(
        await dccFetch(`/api/ai/research/review-sources${buildQuery({ limit })}`),
      ),
  );

  server.tool(
    "get_review_intel_source",
    "Detail review intelligence: ringkasan sentimen, keluhan/pujian, gap opportunity, sample review.",
    { sourceId: idSchema },
    async ({ sourceId }) =>
      asText(
        await dccFetch(
          `/api/ai/research/review-sources/${encodeURIComponent(sourceId)}`,
        ),
      ),
  );

  server.tool(
    "list_trend_digests",
    "Daftar digest Trend Radar mingguan (global & watchlist).",
    { limit: limitSchema.describe("Default 20, maks 30") },
    async ({ limit }) =>
      asText(
        await dccFetch(`/api/ai/research/trend-digests${buildQuery({ limit })}`),
      ),
  );

  server.tool(
    "get_trend_digest",
    "Detail digest tren: narasi, item per fase (emerging/growing/peak/declining), action plan.",
    { digestId: idSchema },
    async ({ digestId }) =>
      asText(
        await dccFetch(
          `/api/ai/research/trend-digests/${encodeURIComponent(digestId)}`,
        ),
      ),
  );

  server.tool(
    "list_keyword_intel_queries",
    "Daftar analisis Keyword Intel (kategori, seed keyword, status).",
    { limit: limitSchema.describe("Default 30, maks 50") },
    async ({ limit }) =>
      asText(
        await dccFetch(`/api/ai/research/keyword-queries${buildQuery({ limit })}`),
      ),
  );

  server.tool(
    "get_keyword_intel_query",
    "Detail keyword intel: matrix keyword, gap keywords, copy suggestions, seasonal calendar.",
    { queryId: idSchema },
    async ({ queryId }) =>
      asText(
        await dccFetch(
          `/api/ai/research/keyword-queries/${encodeURIComponent(queryId)}`,
        ),
      ),
  );

  server.tool(
    "list_social_listening_monitors",
    "Daftar monitor Social Listening (keyword, platform TikTok/Instagram).",
    { limit: limitSchema.describe("Default 30, maks 50") },
    async ({ limit }) =>
      asText(
        await dccFetch(`/api/ai/research/social-monitors${buildQuery({ limit })}`),
      ),
  );

  server.tool(
    "get_social_listening_monitor",
    "Detail social listening: pain points, wishlist, viral content, top mentions, action plan.",
    { monitorId: idSchema },
    async ({ monitorId }) =>
      asText(
        await dccFetch(
          `/api/ai/research/social-monitors/${encodeURIComponent(monitorId)}`,
        ),
      ),
  );

  server.tool(
    "list_usp_gap_analyses",
    "Daftar analisis USP & Gap positioning per kategori.",
    { limit: limitSchema.describe("Default 30, maks 50") },
    async ({ limit }) =>
      asText(
        await dccFetch(`/api/ai/research/usp-analyses${buildQuery({ limit })}`),
      ),
  );

  server.tool(
    "get_usp_gap_analysis",
    "Detail USP analyzer: gap matrix, claim analysis, positioning map, USP candidates.",
    { analysisId: idSchema },
    async ({ analysisId }) =>
      asText(
        await dccFetch(
          `/api/ai/research/usp-analyses/${encodeURIComponent(analysisId)}`,
        ),
      ),
  );

  server.tool(
    "list_product_concepts",
    "Daftar konsep produk di Concept Lab beserta skor validasi.",
    { limit: limitSchema.describe("Default 40, maks 50") },
    async ({ limit }) =>
      asText(
        await dccFetch(`/api/ai/research/concepts${buildQuery({ limit })}`),
      ),
  );

  server.tool(
    "get_product_concept",
    "Detail konsep produk: data konsep, skor validasi, risk factors, source modules.",
    { conceptId: idSchema },
    async ({ conceptId }) =>
      asText(
        await dccFetch(
          `/api/ai/research/concepts/${encodeURIComponent(conceptId)}`,
        ),
      ),
  );

  server.tool(
    "list_product_discovery_queries",
    "Daftar query Product Discovery (keyword marketplace, status scrape).",
    { limit: limitSchema.describe("Default 30, maks 50") },
    async ({ limit }) =>
      asText(
        await dccFetch(
          `/api/ai/research/product-discovery${buildQuery({ limit })}`,
        ),
      ),
  );

  server.tool(
    "get_product_discovery_query",
    "Detail product discovery: produk teratas marketplace, AI insights & action plan.",
    { queryId: idSchema },
    async ({ queryId }) =>
      asText(
        await dccFetch(
          `/api/ai/research/product-discovery/${encodeURIComponent(queryId)}`,
        ),
      ),
  );

  server.tool(
    "list_research_reports",
    "Daftar laporan riset (weekly, custom, category deep dive, dll).",
    { limit: limitSchema.describe("Default 20, maks 30") },
    async ({ limit }) =>
      asText(
        await dccFetch(`/api/ai/research/reports${buildQuery({ limit })}`),
      ),
  );

  server.tool(
    "get_research_report",
    "Detail laporan riset lengkap: sections, summary, action items, metrics.",
    { reportId: idSchema },
    async ({ reportId }) =>
      asText(
        await dccFetch(
          `/api/ai/research/reports/${encodeURIComponent(reportId)}`,
        ),
      ),
  );
}
