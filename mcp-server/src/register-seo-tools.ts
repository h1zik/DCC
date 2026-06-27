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

/** Daftarkan tools SEO Toolkit (keyword research, rank check, on-page audit). */
export function registerSeoTools(server: McpServer, deps: Deps) {
  const { dccFetch, buildQuery, asText, limitSchema } = deps;

  server.tool(
    "seo_keyword_research",
    "Riset keyword SEO untuk pasar Indonesia (Google): volume pencarian, difficulty, CPC, dan intent. Pakai untuk 'keyword apa yang dicari', 'volume keyword X', 'long-tail untuk Y'. Sumber: DataForSEO Labs.",
    {
      seed: z
        .string()
        .min(1)
        .describe("Seed keyword, mis. 'serum vitamin c'"),
      limit: limitSchema,
    },
    async ({ seed, limit }) =>
      asText(
        await dccFetch(
          `/api/ai/seo/keyword-research${buildQuery({ seed, limit })}`,
        ),
      ),
  );

  server.tool(
    "seo_rank_check",
    "Cek posisi sebuah domain di Google Indonesia untuk satu keyword (organik, top 100). Pakai untuk 'ranking domain X untuk keyword Y', 'posisi kami di Google'.",
    {
      keyword: z.string().min(1).describe("Keyword pencarian"),
      domain: z
        .string()
        .min(1)
        .describe("Domain target, mis. 'brandanda.com'"),
      device: z
        .enum(["desktop", "mobile"])
        .optional()
        .describe("Default mobile"),
    },
    async ({ keyword, domain, device }) =>
      asText(
        await dccFetch(
          `/api/ai/seo/rank-check${buildQuery({ keyword, domain, device })}`,
        ),
      ),
  );

  server.tool(
    "seo_onpage_audit",
    "Audit On-Page satu URL: skor 0-100 + daftar isu (title, meta description, H1, schema, alt, dll) dengan severity + rekomendasi. Pakai untuk 'audit halaman X', 'kenapa halaman ini kurang SEO'.",
    {
      url: z.string().min(1).describe("URL halaman lengkap"),
      keyword: z
        .string()
        .optional()
        .describe("Keyword target (opsional) untuk cek penggunaan keyword"),
    },
    async ({ url, keyword }) =>
      asText(
        await dccFetch(
          `/api/ai/seo/onpage-audit${buildQuery({ url, keyword })}`,
        ),
      ),
  );
}
