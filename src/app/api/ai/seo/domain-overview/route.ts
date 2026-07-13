import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiError, aiApiOk } from "@/lib/ai-api/response";
import { prisma } from "@/lib/prisma";

/**
 * Domain Overview tersimpan (read-only, untuk MCP). Query: `target?` —
 * tanpa target mengembalikan daftar analisis terbaru.
 */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const target = url.searchParams.get("target")?.trim().toLowerCase();

  try {
    if (!target) {
      const rows = await prisma.seoDomainOverview.findMany({
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { id: true, target: true, status: true, updatedAt: true },
      });
      return aiApiOk({ count: rows.length, analyses: rows }, guard.ctx.role);
    }

    const row = await prisma.seoDomainOverview.findFirst({
      where: { target, status: "READY" },
      orderBy: { updatedAt: "desc" },
    });
    if (!row) {
      return aiApiError(
        `Belum ada analisis READY untuk "${target}" — buat dulu di dashboard /seo/domain-overview.`,
        404,
      );
    }

    return aiApiOk(
      {
        target: row.target,
        updatedAt: row.updatedAt,
        overview: row.overview,
        topKeywords: row.topKeywords,
        competitors: row.competitors,
        dataNotice: row.dataNotice,
      },
      guard.ctx.role,
    );
  } catch (err) {
    return aiApiError(
      err instanceof Error ? err.message : "Gagal mengambil domain overview.",
      502,
    );
  }
}
