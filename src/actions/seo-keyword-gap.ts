"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SeoAnalysisStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSeoAccess } from "@/lib/seo/auth";
import { actionErrorMessage } from "@/lib/action-error-message";
import { normalizeDomain } from "@/lib/seo/dataforseo/serp-parse";
import { runKeywordGap } from "@/lib/seo/keyword-gap/analyzer";
import type { GapRow } from "@/lib/seo/keyword-gap/gap-logic";
import { fetchPageIntersection } from "@/lib/seo/dataforseo/labs-domain";
import { isDataForSeoConfigured } from "@/lib/seo/dataforseo/client";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  target: z.string().min(3).max(200),
  competitors: z.array(z.string().min(3).max(200)).min(1).max(3),
});

export async function createSeoKeywordGap(input: z.infer<typeof createSchema>) {
  const session = await requireSeoAccess();
  const data = createSchema.parse(input);

  const target = normalizeDomain(data.target);
  if (!target) throw new Error("Domain target tidak valid.");

  const seen = new Set<string>([target]);
  const competitors: string[] = [];
  for (const raw of data.competitors) {
    const domain = normalizeDomain(raw);
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    competitors.push(domain);
  }
  if (competitors.length === 0) {
    throw new Error("Minimal satu domain kompetitor yang valid.");
  }

  const gap = await prisma.seoKeywordGap.create({
    data: {
      name: data.name.trim(),
      target,
      competitors,
      createdById: session.user.id,
    },
  });

  after(async () => {
    try {
      await runKeywordGap(gap.id);
    } catch (err) {
      console.error("[createSeoKeywordGap] gagal", err);
    }
  });

  revalidatePath("/seo/keyword-gap");
  revalidatePath(`/seo/keyword-gap/${gap.id}`);
  return { id: gap.id };
}

export async function refreshSeoKeywordGap(gapId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(gapId);

  await prisma.seoKeywordGap.update({
    where: { id: gapId },
    data: { status: "PENDING", errorMessage: null, dataNotice: null },
  });

  after(async () => {
    try {
      await runKeywordGap(gapId);
    } catch (err) {
      console.error("[refreshSeoKeywordGap] gagal", err);
    }
  });
  revalidatePath(`/seo/keyword-gap/${gapId}`);
}

export async function deleteSeoKeywordGap(gapId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(gapId);
  await prisma.seoKeywordGap.delete({ where: { id: gapId } });
  revalidatePath("/seo/keyword-gap");
}

const comparePagesSchema = z.object({
  page1: z.string().url().max(500),
  page2: z.string().url().max(500),
});

/**
 * Bedah halaman vs halaman (Labs page_intersection): keyword yang di-ranking
 * masing-masing URL. Ephemeral — hasil dikembalikan langsung (tetap ter-cache
 * di DataForSeoCache; default 24 jam).
 */
export async function comparePagesAction(
  input: z.infer<typeof comparePagesSchema>,
) {
  await requireSeoAccess();
  const data = comparePagesSchema.parse(input);
  if (!isDataForSeoConfigured()) {
    throw new Error("DataForSEO belum dikonfigurasi.");
  }

  try {
    const rows = await fetchPageIntersection(data.page1, data.page2, {
      limit: 200,
    });
    return { rows };
  } catch (err) {
    throw new Error(actionErrorMessage(err, "Gagal membandingkan halaman."));
  }
}

const sendSchema = z.object({
  gapId: z.string().min(1),
  keywords: z.array(z.string().min(1).max(200)).min(1).max(100),
  projectName: z.string().min(1).max(120),
});

/**
 * "Kirim ke Keyword Research": buat SeoKeywordProject berisi keyword
 * missing/weak terpilih — glue lintas modul ala Semrush.
 */
export async function sendGapKeywordsToResearch(
  input: z.infer<typeof sendSchema>,
) {
  const session = await requireSeoAccess();
  const data = sendSchema.parse(input);

  try {
    const gap = await prisma.seoKeywordGap.findUnique({
      where: { id: data.gapId },
    });
    if (!gap) throw new Error("Keyword gap tidak ditemukan.");

    const rows = Array.isArray(gap.rows) ? (gap.rows as unknown as GapRow[]) : [];
    const byKeyword = new Map(rows.map((r) => [r.keyword.toLowerCase(), r]));

    const project = await prisma.seoKeywordProject.create({
      data: {
        name: data.projectName.trim(),
        description: `Dari Keyword Gap "${gap.name}" (${gap.target} vs ${gap.competitors.join(", ")}).`,
        seedKeyword: data.keywords[0],
        status: SeoAnalysisStatus.READY,
        createdById: session.user.id,
        keywords: {
          createMany: {
            data: data.keywords.map((kw) => {
              const row = byKeyword.get(kw.toLowerCase());
              return {
                keyword: kw,
                searchVolume: row?.searchVolume ?? null,
                difficulty: row?.difficulty ?? null,
                source: "keyword_gap",
              };
            }),
            skipDuplicates: true,
          },
        },
      },
    });

    revalidatePath("/seo/keyword-research");
    return { projectId: project.id };
  } catch (err) {
    throw new Error(actionErrorMessage(err, "Gagal mengirim keyword."));
  }
}
