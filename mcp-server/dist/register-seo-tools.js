import { z } from "zod";
/** Daftarkan tools SEO Toolkit (keyword research, rank check, on-page audit). */
export function registerSeoTools(server, deps) {
    const { dccFetch, buildQuery, asText, limitSchema } = deps;
    server.tool("seo_keyword_research", "Riset keyword SEO untuk pasar Indonesia (Google): volume pencarian, difficulty, CPC, dan intent. Pakai untuk 'keyword apa yang dicari', 'volume keyword X', 'long-tail untuk Y'. Sumber: DataForSEO Labs.", {
        seed: z
            .string()
            .min(1)
            .describe("Seed keyword, mis. 'serum vitamin c'"),
        limit: limitSchema,
    }, async ({ seed, limit }) => asText(await dccFetch(`/api/ai/seo/keyword-research${buildQuery({ seed, limit })}`)));
    server.tool("seo_rank_check", "Cek posisi sebuah domain di Google Indonesia untuk satu keyword (organik, top 100). Pakai untuk 'ranking domain X untuk keyword Y', 'posisi kami di Google'.", {
        keyword: z.string().min(1).describe("Keyword pencarian"),
        domain: z
            .string()
            .min(1)
            .describe("Domain target, mis. 'brandanda.com'"),
        device: z
            .enum(["desktop", "mobile"])
            .optional()
            .describe("Default mobile"),
    }, async ({ keyword, domain, device }) => asText(await dccFetch(`/api/ai/seo/rank-check${buildQuery({ keyword, domain, device })}`)));
    server.tool("seo_onpage_audit", "Audit On-Page satu URL: skor 0-100 + daftar isu (title, meta description, H1, schema, alt, dll) dengan severity + rekomendasi. Pakai untuk 'audit halaman X', 'kenapa halaman ini kurang SEO'.", {
        url: z.string().min(1).describe("URL halaman lengkap"),
        keyword: z
            .string()
            .optional()
            .describe("Keyword target (opsional) untuk cek penggunaan keyword"),
    }, async ({ url, keyword }) => asText(await dccFetch(`/api/ai/seo/onpage-audit${buildQuery({ url, keyword })}`)));
    server.tool("seo_visibility", "Visibility score (0-100%, ala Semrush) + distribusi posisi per proyek rank tracker. Pakai untuk 'seberapa visible kita di Google', 'ringkasan performa SEO'. Dihitung dari data lokal — instan & gratis.", {}, async () => asText(await dccFetch("/api/ai/seo/visibility")));
    server.tool("seo_domain_overview", "Potret organik satu domain (analisis tersimpan): estimasi trafik, jumlah keyword per posisi, top keywords, dan kompetitor organik. Tanpa `target` → daftar analisis yang ada. Pakai untuk 'profil SEO domain X', 'trafik organik kompetitor'.", {
        target: z
            .string()
            .optional()
            .describe("Domain, mis. 'kompetitor.co.id' (kosongkan untuk daftar)"),
    }, async ({ target }) => asText(await dccFetch(`/api/ai/seo/domain-overview${buildQuery({ target })}`)));
    server.tool("seo_keyword_gap", "Keyword gap vs kompetitor (analisis tersimpan): bucket missing/weak/strong/shared/untapped. Tanpa `gapId` → daftar analisis. Pakai untuk 'keyword yang kompetitor ranking tapi kita tidak'.", {
        gapId: z.string().optional().describe("ID analisis gap (kosongkan untuk daftar)"),
        bucket: z
            .enum(["missing", "weak", "strong", "shared", "untapped"])
            .optional()
            .describe("Filter bucket"),
        limit: limitSchema,
    }, async ({ gapId, bucket, limit }) => asText(await dccFetch(`/api/ai/seo/keyword-gap${buildQuery({ gapId, bucket, limit })}`)));
    server.tool("seo_content_opportunities", "Feed rekomendasi artikel SEO: keyword terbaik untuk digarap (artikel baru vs optimasi konten existing di posisi 5-20), skor peluang, judul usulan, dan stage pipeline (ide→brief→draft→terbit). Pakai untuk 'artikel apa yang sebaiknya ditulis'.", {
        stage: z
            .enum(["IDEA", "BRIEFED", "DRAFTED", "PUBLISHED"])
            .optional()
            .describe("Filter stage pipeline"),
        type: z
            .enum(["NEW_ARTICLE", "OPTIMIZE_EXISTING"])
            .optional()
            .describe("Filter tipe peluang"),
        limit: limitSchema,
    }, async ({ stage, type, limit }) => asText(await dccFetch(`/api/ai/seo/content-opportunities${buildQuery({ stage, type, limit })}`)));
}
