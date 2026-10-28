import "server-only";

import { Prisma, SeoAnalysisStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DataForSeoError,
  isDataForSeoConfigured,
} from "@/lib/seo/dataforseo/client";
import {
  fetchLlmResponse,
  type AiPlatform,
} from "@/lib/seo/dataforseo/ai-optimization";
import {
  buildExcerpt,
  buildFailureNotice,
  buildRunSummary,
  classifyAiVisibilityError,
  detectBrandMention,
  type AiVisibilityResult,
} from "@/lib/seo/ai-visibility/rules";

/**
 * AI Visibility Tracker: untuk tiap keyword × platform, tanyakan prompt
 * rekomendasi ala pengguna nyata lalu cek apakah brand disebut di jawaban/
 * sitasi. Hasil per-cek dipersist bertahap (resumable-ish via re-run).
 *
 * Setiap run selalu menanyakan ulang ke LLM (`fresh: true`, melewati cache
 * 24 jam) — jawaban LLM non-deterministik, jadi re-run harus menghasilkan
 * sampel baru, bukan salinan run sebelumnya.
 */

export function buildVisibilityPrompt(keyword: string): string {
  return `Apa rekomendasi ${keyword} terbaik di Indonesia saat ini? Sebutkan beberapa merek atau produk spesifik.`;
}

function describeCheckError(err: unknown): Pick<
  AiVisibilityResult,
  "error" | "errorKind"
> {
  if (err instanceof DataForSeoError) {
    return {
      error: err.message,
      errorKind: classifyAiVisibilityError({
        message: err.message,
        statusCode: err.statusCode,
        balanceExhausted: err.balanceExhausted,
      }),
    };
  }
  const message = err instanceof Error ? err.message : "Cek gagal.";
  return {
    error: message,
    errorKind: classifyAiVisibilityError({ message, statusCode: null }),
  };
}

export async function runAiVisibility(runId: string): Promise<void> {
  const run = await prisma.seoAiVisibilityRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Run AI visibility tidak ditemukan.");

  if (!isDataForSeoConfigured()) {
    await prisma.seoAiVisibilityRun.update({
      where: { id: runId },
      data: {
        status: SeoAnalysisStatus.FAILED,
        errorMessage:
          "DataForSEO belum dikonfigurasi (set DATAFORSEO_LOGIN & DATAFORSEO_PASSWORD).",
      },
    });
    return;
  }

  await prisma.seoAiVisibilityRun.update({
    where: { id: runId },
    data: {
      status: SeoAnalysisStatus.COLLECTING,
      errorMessage: null,
      dataNotice: null,
      results: [],
      summary: Prisma.JsonNull,
    },
  });

  const results: AiVisibilityResult[] = [];

  try {
    for (const keyword of run.keywords) {
      const prompt = buildVisibilityPrompt(keyword);
      for (const platform of run.platforms as AiPlatform[]) {
        try {
          const answer = await fetchLlmResponse(platform, prompt, { fresh: true });
          const mention = detectBrandMention(
            answer.text,
            answer.citations,
            run.brandTerms,
          );
          results.push({
            keyword,
            platform,
            prompt,
            mentioned: mention.mentioned,
            matchedTerms: mention.matchedTerms,
            excerpt: buildExcerpt(answer.text, mention.matchedTerms),
            citations: answer.citations.slice(0, 8),
            modelName: answer.modelName,
            modelFallback: answer.modelFallback,
          });
        } catch (err) {
          results.push({
            keyword,
            platform,
            prompt,
            mentioned: false,
            matchedTerms: [],
            excerpt: "",
            citations: [],
            ...describeCheckError(err),
          });
        }
        // Persist bertahap agar progres terlihat.
        await prisma.seoAiVisibilityRun.update({
          where: { id: runId },
          data: { results: results as unknown as Prisma.InputJsonValue },
        });
      }
    }

    const summary = buildRunSummary(results);
    const notices: string[] = [];
    const failureNotice = buildFailureNotice(results);
    if (failureNotice) notices.push(failureNotice);
    if (summary.totalChecks === 0) {
      notices.push(
        "Tidak ada cek yang berhasil. Pastikan akun DataForSEO punya akses AI Optimization API dan saldo cukup.",
      );
    }

    await prisma.seoAiVisibilityRun.update({
      where: { id: runId },
      data: {
        status: SeoAnalysisStatus.READY,
        results: results as unknown as Prisma.InputJsonValue,
        summary: summary as unknown as Prisma.InputJsonValue,
        dataNotice: notices.length ? notices.join(" ") : null,
        errorMessage: null,
      },
    });
  } catch (err) {
    await prisma.seoAiVisibilityRun.update({
      where: { id: runId },
      data: {
        status: SeoAnalysisStatus.FAILED,
        errorMessage:
          err instanceof Error ? err.message : "Run AI visibility gagal.",
      },
    });
    throw err;
  }
}
