import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

type Deps = {
  dccFetch: (path: string) => Promise<unknown>;
  buildQuery: (
    params: Record<string, string | number | boolean | undefined>,
  ) => string;
  asText: (data: unknown) => {
    content: { type: "text"; text: string }[];
  };
  limitSchema: z.ZodOptional<z.ZodNumber>;
};

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, "Format YYYY-MM-DD")
  .optional();

/**
 * Daftarkan tools KOL Hub (read-only): database KOL, jadwal, performa
 * campaign & budget, antrean approval. Hanya untuk toolset `full` —
 * data kontak/rekening KOL tidak pernah dikirim oleh API.
 */
export function registerKolTools(server: McpServer, deps: Deps) {
  const { dccFetch, buildQuery, asText, limitSchema } = deps;

  server.tool(
    "list_kol_profiles",
    "KOL Hub: daftar KOL/influencer — status, kategori, akun Instagram/TikTok (follower, tier, rate card, verdict & skor keaslian audit Brand Hub, median views), jumlah jadwal & yang sudah tayang. Pakai untuk 'KOL aktif kategori skincare', 'siapa KOL TikTok kita'. Akses: CEO/Administrator/Brand Manager.",
    {
      status: z
        .enum(["WAITING_APPROVAL", "ACTIVE", "BLACKLISTED", "REJECTED"])
        .optional()
        .describe("Filter status KOL"),
      platform: z
        .enum(["INSTAGRAM", "TIKTOK"])
        .optional()
        .describe("Hanya KOL yang punya akun di platform ini"),
      categoryName: z
        .string()
        .optional()
        .describe("Nama kategori KOL (cocok sebagian)"),
      q: z.string().optional().describe("Cari nama atau handle (@...)"),
      limit: limitSchema,
    },
    async ({ status, platform, categoryName, q, limit }) =>
      asText(
        await dccFetch(
          `/api/ai/kol/profiles${buildQuery({ status, platform, categoryName, q, limit })}`,
        ),
      ),
  );

  server.tool(
    "get_kol_profile",
    "KOL Hub: detail satu KOL (id dari list_kol_profiles) — akun & audit, ringkasan performa (biaya terkomitmen, views, FYP rate, CPM), dan 20 jadwal terbaru (brand, campaign, status, biaya, views, FYP, CPM, status bayar).",
    {
      kolId: z.string().min(1).describe("ID KOL"),
    },
    async ({ kolId }) =>
      asText(
        await dccFetch(`/api/ai/kol/profiles/${encodeURIComponent(kolId)}`),
      ),
  );

  server.tool(
    "list_kol_schedules",
    "KOL Hub: jadwal/slot konten KOL — per baris biaya (rate + biaya tambahan), views, likes, CPM, FYP, link post, dan status pembayaran Finance. Filter status, brand, campaign, KOL, dan rentang tanggal tayang (scheduledAt).",
    {
      status: z
        .enum([
          "DRAFT",
          "PENDING_APPROVAL",
          "APPROVED",
          "SCHEDULED",
          "POSTED",
          "REJECTED",
          "CANCELLED",
        ])
        .optional()
        .describe("Filter status jadwal"),
      brandId: z.string().optional().describe("ID brand (lihat list_brands)"),
      campaignId: z.string().optional().describe("ID campaign KOL"),
      kolId: z.string().optional().describe("ID KOL"),
      from: dateSchema.describe("Tanggal awal YYYY-MM-DD (WIB)"),
      to: dateSchema.describe("Tanggal akhir YYYY-MM-DD (WIB, inklusif)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe("Maks baris (default 50, maks 200)"),
    },
    async ({ status, brandId, campaignId, kolId, from, to, limit }) =>
      asText(
        await dccFetch(
          `/api/ai/kol/schedules${buildQuery({ status, brandId, campaignId, kolId, from, to, limit })}`,
        ),
      ),
  );

  server.tool(
    "get_kol_campaign_performance",
    "KOL Hub: performa per campaign — jumlah slot, tayang, total biaya terkomitmen, total views, FYP count/rate, rata-rata CPM, plus budget (awal, terpakai, sisa). Pakai untuk 'campaign KOL mana paling efisien', 'sisa budget endorse brand X'.",
    {
      campaignId: z.string().optional().describe("ID campaign (opsional)"),
      brandId: z.string().optional().describe("ID brand (opsional)"),
      from: dateSchema.describe("Filter slot dari tanggal YYYY-MM-DD"),
      to: dateSchema.describe("Filter slot sampai tanggal YYYY-MM-DD"),
      limit: limitSchema,
    },
    async ({ campaignId, brandId, from, to, limit }) =>
      asText(
        await dccFetch(
          `/api/ai/kol/campaigns${buildQuery({ campaignId, brandId, from, to, limit })}`,
        ),
      ),
  );

  server.tool(
    "get_kol_pending_approvals",
    "KOL Hub: antrean approval — jumlah & daftar pengajuan perubahan profil KOL (nama KOL, tipe, tanggal) serta jadwal PENDING_APPROVAL dikelompokkan per order (nomor order, KOL, brand, campaign, slot, total nilai).",
    {
      limit: limitSchema,
    },
    async ({ limit }) =>
      asText(await dccFetch(`/api/ai/kol/approvals${buildQuery({ limit })}`)),
  );
}
