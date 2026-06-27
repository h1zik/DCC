import "server-only";

import * as cheerio from "cheerio";
import { Prisma, SeoAnalysisStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DataForSeoError, isDataForSeoConfigured } from "@/lib/seo/dataforseo/client";
import { fetchInstantPage, type InstantPageSignals } from "@/lib/seo/dataforseo/onpage";
import {
  buildOnPageIssues,
  computeOnPageScore,
  sortIssuesBySeverity,
  type AuditInput,
} from "@/lib/seo/onpage-audit/audit-rules";
import {
  buildResearchAiStep,
  generateResearchJson,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";

/* -------------------------- HTML enrichment (cheerio) -------------------------- */

type HtmlSignals = {
  title: string | null;
  description: string | null;
  htags: Record<string, string[]>;
  imagesTotal: number;
  imagesWithoutAlt: number;
  schemaTypes: string[];
  wordCount: number;
  keywordInTitle: boolean | null;
  keywordInDescription: boolean | null;
  keywordInH1: boolean | null;
  keywordDensity: number | null;
};

function collectSchemaTypes(node: unknown, out: Set<string>): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) collectSchemaTypes(n, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  if (typeof type === "string") out.add(type);
  else if (Array.isArray(type)) type.forEach((t) => typeof t === "string" && out.add(t));
  if (obj["@graph"]) collectSchemaTypes(obj["@graph"], out);
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

/** Ambil & parse HTML langsung untuk melengkapi sinyal (best-effort). */
async function fetchHtmlSignals(
  url: string,
  targetKeyword: string | null,
): Promise<HtmlSignals | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; DCC-SEO-Audit/1.0; +https://dominatuscenter.com)",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $("title").first().text().trim() || null;
    const description =
      $('meta[name="description"]').attr("content")?.trim() || null;

    const htags: Record<string, string[]> = {};
    for (const h of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
      htags[h] = $(h)
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(Boolean);
    }

    const images = $("img");
    let imagesWithoutAlt = 0;
    images.each((_, el) => {
      const alt = $(el).attr("alt");
      if (!alt || !alt.trim()) imagesWithoutAlt += 1;
    });

    const schema = new Set<string>();
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        collectSchemaTypes(JSON.parse($(el).contents().text()), schema);
      } catch {
        /* abaikan JSON-LD rusak */
      }
    });
    $("[itemtype]").each((_, el) => {
      const t = $(el).attr("itemtype");
      if (t) schema.add(t.split("/").pop() || t);
    });

    $("script, style, noscript").remove();
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    const words = bodyText ? bodyText.split(/\s+/) : [];
    const wordCount = words.length;

    let keywordInTitle: boolean | null = null;
    let keywordInDescription: boolean | null = null;
    let keywordInH1: boolean | null = null;
    let keywordDensity: number | null = null;
    if (targetKeyword) {
      const kw = targetKeyword.toLowerCase();
      keywordInTitle = (title ?? "").toLowerCase().includes(kw);
      keywordInDescription = (description ?? "").toLowerCase().includes(kw);
      keywordInH1 = htags.h1.some((h) => h.toLowerCase().includes(kw));
      const occ = countOccurrences(bodyText.toLowerCase(), kw);
      keywordDensity = wordCount > 0 ? occ / wordCount : 0;
    }

    return {
      title,
      description,
      htags,
      imagesTotal: images.length,
      imagesWithoutAlt,
      schemaTypes: [...schema],
      wordCount,
      keywordInTitle,
      keywordInDescription,
      keywordInH1,
      keywordDensity,
    };
  } catch {
    return null;
  }
}

/* --------------------------------- analyzer --------------------------------- */

export async function runOnPageAudit(auditId: string): Promise<void> {
  const audit = await prisma.seoOnPageAudit.findUnique({ where: { id: auditId } });
  if (!audit) throw new Error("Audit tidak ditemukan.");

  await prisma.seoOnPageAudit.update({
    where: { id: auditId },
    data: { status: SeoAnalysisStatus.COLLECTING, errorMessage: null, dataNotice: null },
  });

  try {
    // 1) DataForSEO instant_pages (best-effort) + 2) parsing HTML langsung.
    let dfs: InstantPageSignals | null = null;
    let dfsNotice: string | null = null;
    if (isDataForSeoConfigured()) {
      try {
        dfs = await fetchInstantPage(audit.url);
      } catch (err) {
        if (err instanceof DataForSeoError && err.balanceExhausted) {
          dfsNotice = "Saldo DataForSEO habis — audit memakai analisis HTML langsung.";
        } else {
          dfsNotice = "DataForSEO gagal — audit memakai analisis HTML langsung.";
        }
        console.warn("[seo/onpage-audit] instant_pages gagal", err);
      }
    } else {
      dfsNotice = "DataForSEO belum dikonfigurasi — audit memakai analisis HTML langsung.";
    }

    const html = await fetchHtmlSignals(audit.url, audit.targetKeyword);

    if (!dfs && !html) {
      await prisma.seoOnPageAudit.update({
        where: { id: auditId },
        data: {
          status: SeoAnalysisStatus.FAILED,
          errorMessage:
            "Tidak bisa mengambil data halaman (DataForSEO & fetch langsung gagal). Pastikan URL benar & dapat diakses.",
        },
      });
      return;
    }

    await prisma.seoOnPageAudit.update({
      where: { id: auditId },
      data: { status: SeoAnalysisStatus.ANALYZING },
    });

    // Gabungkan sinyal (utamakan DataForSEO, lengkapi dari HTML).
    const htags =
      dfs && Object.keys(dfs.htags).length > 0 ? dfs.htags : (html?.htags ?? {});
    const h1Count = Array.isArray(htags.h1) ? htags.h1.length : 0;
    const title = dfs?.title ?? html?.title ?? null;
    const description = dfs?.description ?? html?.description ?? null;
    const wordCount = dfs?.wordCount ?? html?.wordCount ?? null;
    const hasSchema =
      dfs?.hasSchema ?? (html ? html.schemaTypes.length > 0 : null);

    const input: AuditInput = {
      onpageScore: dfs?.onpageScore ?? null,
      title,
      description,
      h1Count,
      wordCount,
      hasSchema,
      checks: dfs?.checks ?? {},
      targetKeyword: audit.targetKeyword,
      keywordInTitle: html?.keywordInTitle ?? null,
      keywordInDescription: html?.keywordInDescription ?? null,
      keywordInH1: html?.keywordInH1 ?? null,
      imagesWithoutAlt: html?.imagesWithoutAlt ?? null,
    };

    const issues = sortIssuesBySeverity(buildOnPageIssues(input));
    const score = computeOnPageScore(issues);

    const signals = {
      source: dfs ? (html ? "dataforseo+html" : "dataforseo") : "html",
      statusCode: dfs?.statusCode ?? null,
      dataforseoScore: dfs?.onpageScore ?? null,
      title,
      titleLength: title?.length ?? null,
      description,
      descriptionLength: description?.length ?? null,
      wordCount,
      internalLinks: dfs?.internalLinks ?? null,
      externalLinks: dfs?.externalLinks ?? null,
      imagesCount: dfs?.imagesCount ?? html?.imagesTotal ?? null,
      imagesWithoutAlt: html?.imagesWithoutAlt ?? null,
      hasSchema,
      schemaTypes: html?.schemaTypes ?? [],
      readability: dfs?.readability ?? null,
      keywordDensity: html?.keywordDensity ?? null,
    };

    const aiRecommendations = await generateRecommendations(
      audit.url,
      audit.targetKeyword,
      signals,
      issues,
    );

    const aiMeta = aiRecommendations
      ? (researchAiMetaFromSteps([
          buildResearchAiStep("SEO on-page recommendations", "pro"),
        ]) as object)
      : undefined;

    await prisma.seoOnPageAudit.update({
      where: { id: auditId },
      data: {
        status: SeoAnalysisStatus.READY,
        score,
        signals: signals as unknown as Prisma.InputJsonValue,
        headings: htags as unknown as Prisma.InputJsonValue,
        issues: issues as unknown as Prisma.InputJsonValue,
        aiRecommendations: aiRecommendations
          ? (aiRecommendations as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        aiMeta,
        dataNotice: dfsNotice,
        errorMessage: null,
      },
    });
  } catch (err) {
    const message =
      err instanceof DataForSeoError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Audit gagal.";
    await prisma.seoOnPageAudit.update({
      where: { id: auditId },
      data: { status: SeoAnalysisStatus.FAILED, errorMessage: message },
    });
    throw err;
  }
}

export async function enqueueOnPageAudit(auditId: string): Promise<void> {
  await runOnPageAudit(auditId);
}

type AiRecommendation = {
  title: string;
  detail: string;
  priority: string;
};

async function generateRecommendations(
  url: string,
  targetKeyword: string | null,
  signals: Record<string, unknown>,
  issues: { message: string; severity: string }[],
): Promise<{ recommendations: AiRecommendation[]; readabilityNote: string | null } | null> {
  const prompt = `Kamu adalah konsultan SEO untuk brand kosmetik/skincare Indonesia.
Audit On-Page untuk URL: ${url}
${targetKeyword ? `Keyword target: "${targetKeyword}"` : ""}

Sinyal halaman:
${JSON.stringify(signals, null, 2)}

Isu terdeteksi:
${issues.map((i) => `- [${i.severity}] ${i.message}`).join("\n") || "- (tidak ada isu mayor)"}

Tugas:
1. Beri rekomendasi actionable & spesifik (Bahasa Indonesia) untuk memperbaiki SEO on-page halaman ini.
2. Nilai keterbacaan (readability) konten untuk pembaca Indonesia secara singkat.

Balas HANYA JSON valid:
{
  "recommendations": [{ "title": "string", "detail": "string", "priority": "high|medium|low" }],
  "readabilityNote": "string"
}`;

  try {
    const result = await generateResearchJson<{
      recommendations?: AiRecommendation[];
      readabilityNote?: string;
    }>(prompt, {
      tier: "pro",
      validate: (r) => Array.isArray(r.recommendations),
    });
    const recommendations = Array.isArray(result.recommendations)
      ? result.recommendations
          .filter((r) => r && typeof r.title === "string")
          .map((r) => ({
            title: String(r.title).trim(),
            detail: String(r.detail ?? "").trim(),
            priority: String(r.priority ?? "medium").toLowerCase(),
          }))
      : [];
    return {
      recommendations,
      readabilityNote: result.readabilityNote?.trim() || null,
    };
  } catch (err) {
    console.warn("[seo/onpage-audit] rekomendasi LLM gagal (diabaikan)", err);
    return null;
  }
}
