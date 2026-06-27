import { guardAiApiRequest } from "@/lib/ai-api/guard";
import { aiApiError, aiApiOk } from "@/lib/ai-api/response";
import { isDataForSeoConfigured } from "@/lib/seo/dataforseo/client";
import { fetchInstantPage } from "@/lib/seo/dataforseo/onpage";
import {
  buildOnPageIssues,
  computeOnPageScore,
  sortIssuesBySeverity,
  type AuditInput,
} from "@/lib/seo/onpage-audit/audit-rules";

/**
 * Audit On-Page satu URL (read-only, untuk MCP). Memakai DataForSEO
 * instant_pages. Query: `url`, `keyword?`.
 */
export async function GET(req: Request) {
  const guard = guardAiApiRequest(req);
  if (!guard.ok) return guard.response;

  const reqUrl = new URL(req.url);
  const target = reqUrl.searchParams.get("url")?.trim();
  const keyword = reqUrl.searchParams.get("keyword")?.trim() || null;
  if (!target) return aiApiError("Parameter 'url' wajib.", 400);
  if (!isDataForSeoConfigured()) {
    return aiApiError("DataForSEO belum dikonfigurasi.", 503);
  }

  try {
    const signals = await fetchInstantPage(target);
    if (!signals) return aiApiError("Tidak bisa menganalisis URL.", 502);

    const h1 = Array.isArray(signals.htags.h1) ? signals.htags.h1 : [];
    const kw = keyword?.toLowerCase() ?? null;
    const input: AuditInput = {
      onpageScore: signals.onpageScore,
      title: signals.title,
      description: signals.description,
      h1Count: h1.length,
      wordCount: signals.wordCount,
      hasSchema: signals.hasSchema,
      checks: signals.checks,
      targetKeyword: keyword,
      keywordInTitle: kw ? (signals.title ?? "").toLowerCase().includes(kw) : null,
      keywordInDescription: kw
        ? (signals.description ?? "").toLowerCase().includes(kw)
        : null,
      keywordInH1: kw ? h1.some((h) => h.toLowerCase().includes(kw)) : null,
      imagesWithoutAlt: null,
    };

    const issues = sortIssuesBySeverity(buildOnPageIssues(input));
    const score = computeOnPageScore(issues);

    return aiApiOk(
      {
        url: target,
        score,
        statusCode: signals.statusCode,
        wordCount: signals.wordCount,
        issues: issues.map((i) => ({
          severity: i.severity,
          message: i.message,
          recommendation: i.recommendation,
        })),
      },
      guard.ctx.role,
    );
  } catch (err) {
    return aiApiError(err instanceof Error ? err.message : "Gagal audit.", 502);
  }
}
