import { guardAiApiRequest, parseLimitParam } from "@/lib/ai-api/guard";
import { aiApiError, aiApiOk } from "@/lib/ai-api/response";
import { prisma } from "@/lib/prisma";
import type {
  GapRow,
  GapSummary,
} from "@/lib/seo/keyword-gap/gap-logic";

/**
 * Keyword Gap tersimpan (read-only, untuk MCP). Query: `gapId?`, `bucket?`,
 * `limit?` — tanpa gapId mengembalikan daftar analisis.
 */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const gapId = url.searchParams.get("gapId")?.trim();
  const bucket = url.searchParams.get("bucket")?.trim().toLowerCase();
  const limit = parseLimitParam(url.searchParams.get("limit"), 50, 200);

  try {
    if (!gapId) {
      const rows = await prisma.seoKeywordGap.findMany({
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          name: true,
          target: true,
          competitors: true,
          status: true,
          updatedAt: true,
        },
      });
      return aiApiOk({ count: rows.length, analyses: rows }, guard.ctx.role);
    }

    const gap = await prisma.seoKeywordGap.findUnique({ where: { id: gapId } });
    if (!gap) return aiApiError("Keyword gap tidak ditemukan.", 404);

    const storedSummary =
      gap.summary && typeof gap.summary === "object" && !Array.isArray(gap.summary)
        ? (gap.summary as unknown as GapSummary)
        : null;
    const hasStoredRows = Array.isArray(gap.rows) && gap.rows.length > 0;
    const needsRefresh = hasStoredRows && storedSummary?.version !== 2;
    let rows =
      !needsRefresh && Array.isArray(gap.rows)
        ? (gap.rows as unknown as GapRow[])
        : [];
    if (bucket) {
      rows = rows.filter((r) =>
        (r.buckets ?? [r.bucket]).includes(bucket as GapRow["bucket"]),
      );
    }

    return aiApiOk(
      {
        id: gap.id,
        name: gap.name,
        target: gap.target,
        competitors: gap.competitors,
        status: gap.status,
        summary: needsRefresh ? null : storedSummary,
        rows: rows.slice(0, limit),
        needsRefresh,
        dataNotice: needsRefresh
          ? "Hasil dibuat dengan mesin Keyword Gap lama. Refresh analisis sebelum memakai output."
          : gap.dataNotice,
      },
      guard.ctx.role,
    );
  } catch (err) {
    return aiApiError(
      err instanceof Error ? err.message : "Gagal mengambil keyword gap.",
      502,
    );
  }
}
