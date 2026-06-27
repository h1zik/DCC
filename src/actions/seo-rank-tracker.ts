"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { SeoRankDevice } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSeoAccess } from "@/lib/seo/auth";
import { actionErrorMessage } from "@/lib/action-error-message";
import { normalizeDomain } from "@/lib/seo/dataforseo/serp";
import { runRankCheck } from "@/lib/seo/rank-tracker/rank-check";
import { syncProjectRanks } from "@/lib/seo/rank-tracker/rank-sync";

const MAX_KEYWORDS_PER_PROJECT = 50;

function dedupeKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of keywords) {
    const kw = raw.trim();
    if (!kw) continue;
    const key = kw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(kw);
    if (out.length >= MAX_KEYWORDS_PER_PROJECT) break;
  }
  return out;
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  domain: z.string().min(3).max(200),
  device: z.nativeEnum(SeoRankDevice).optional(),
  locationCode: z.number().int().positive().optional(),
  languageCode: z.string().min(2).max(8).optional(),
  keywords: z.array(z.string()).max(200).optional(),
});

export async function createSeoRankProject(
  input: z.infer<typeof createSchema>,
) {
  const session = await requireSeoAccess();
  const data = createSchema.parse(input);
  const domain = normalizeDomain(data.domain);
  if (!domain) throw new Error("Domain tidak valid.");

  const keywords = dedupeKeywords(data.keywords ?? []);

  const project = await prisma.seoRankProject.create({
    data: {
      name: data.name.trim(),
      domain,
      device: data.device ?? SeoRankDevice.MOBILE,
      locationCode: data.locationCode ?? 2360,
      languageCode: data.languageCode?.trim() || "id",
      createdById: session.user.id,
      keywords: keywords.length
        ? {
            createMany: {
              data: keywords.map((keyword) => ({ keyword })),
              skipDuplicates: true,
            },
          }
        : undefined,
    },
  });

  // Cek awal di background agar pengguna langsung melihat posisi.
  if (keywords.length) {
    after(async () => {
      try {
        await syncProjectRanks(project.id);
        revalidatePath(`/seo/rank-tracker/${project.id}`);
      } catch (err) {
        console.error("[createSeoRankProject] cek awal gagal", err);
      }
    });
  }

  revalidatePath("/seo/rank-tracker");
  return { id: project.id };
}

const addKeywordSchema = z.object({
  projectId: z.string().min(1),
  keyword: z.string().min(1).max(200),
  targetUrl: z.string().max(500).optional(),
});

export async function addTrackedKeyword(
  input: z.infer<typeof addKeywordSchema>,
) {
  await requireSeoAccess();
  const data = addKeywordSchema.parse(input);

  const created = await prisma.seoTrackedKeyword.upsert({
    where: {
      projectId_keyword: {
        projectId: data.projectId,
        keyword: data.keyword.trim(),
      },
    },
    create: {
      projectId: data.projectId,
      keyword: data.keyword.trim(),
      targetUrl: data.targetUrl?.trim() || null,
    },
    update: { targetUrl: data.targetUrl?.trim() || null },
  });

  after(async () => {
    try {
      await runRankCheck(created.id);
      revalidatePath(`/seo/rank-tracker/${data.projectId}`);
    } catch (err) {
      console.error("[addTrackedKeyword] cek gagal", err);
    }
  });

  revalidatePath(`/seo/rank-tracker/${data.projectId}`);
  return { id: created.id };
}

export async function removeTrackedKeyword(keywordId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(keywordId);

  const tk = await prisma.seoTrackedKeyword.delete({
    where: { id: keywordId },
    select: { projectId: true },
  });
  revalidatePath(`/seo/rank-tracker/${tk.projectId}`);
}

/** Cek satu keyword sekarang (inline — dipakai tombol "Cek sekarang"). */
export async function checkRankNow(keywordId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(keywordId);

  const tk = await prisma.seoTrackedKeyword.findUnique({
    where: { id: keywordId },
    select: { projectId: true },
  });
  if (!tk) throw new Error("Keyword tidak ditemukan.");

  try {
    const result = await runRankCheck(keywordId);
    revalidatePath(`/seo/rank-tracker/${tk.projectId}`);
    return { position: result.position };
  } catch (err) {
    throw new Error(actionErrorMessage(err, "Gagal cek ranking."));
  }
}

/** Cek seluruh keyword pada proyek di background. */
export async function checkProjectRanks(projectId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(projectId);

  after(async () => {
    try {
      await syncProjectRanks(projectId);
      revalidatePath(`/seo/rank-tracker/${projectId}`);
    } catch (err) {
      console.error("[checkProjectRanks] gagal", err);
    }
  });

  revalidatePath(`/seo/rank-tracker/${projectId}`);
}

export async function toggleRankProjectActive(
  projectId: string,
  isActive: boolean,
) {
  await requireSeoAccess();
  z.string().min(1).parse(projectId);
  z.boolean().parse(isActive);

  await prisma.seoRankProject.update({
    where: { id: projectId },
    data: { isActive },
  });
  revalidatePath("/seo/rank-tracker");
  revalidatePath(`/seo/rank-tracker/${projectId}`);
}

export async function deleteSeoRankProject(projectId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(projectId);

  await prisma.seoRankProject.delete({ where: { id: projectId } });
  revalidatePath("/seo/rank-tracker");
}
