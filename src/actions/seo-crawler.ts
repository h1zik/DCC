"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SeoCrawlFrequency } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSeoAccess } from "@/lib/seo/auth";
import { normalizeDomain } from "@/lib/seo/dataforseo/serp";
import { startSiteCrawl } from "@/lib/seo/crawler/crawler";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  domain: z.string().min(3).max(200),
  maxPages: z.number().int().min(1).max(1000).optional(),
  includeLighthouse: z.boolean().optional(),
});

export async function createSeoSiteCrawl(
  input: z.infer<typeof createSchema>,
) {
  const session = await requireSeoAccess();
  const data = createSchema.parse(input);
  const domain = normalizeDomain(data.domain);
  if (!domain) throw new Error("Domain tidak valid.");

  const crawl = await prisma.seoSiteCrawl.create({
    data: {
      name: data.name.trim(),
      domain,
      maxPages: data.maxPages ?? 100,
      includeLighthouse: data.includeLighthouse ?? false,
      createdById: session.user.id,
    },
  });

  after(async () => {
    try {
      await startSiteCrawl(crawl.id);
      revalidatePath(`/seo/crawler/${crawl.id}`);
    } catch (err) {
      console.error("[createSeoSiteCrawl] start gagal", err);
    }
  });

  revalidatePath("/seo/crawler");
  return { id: crawl.id };
}

export async function refreshSeoSiteCrawl(crawlId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(crawlId);

  const existing = await prisma.seoSiteCrawl.findUnique({
    where: { id: crawlId },
    select: { id: true },
  });
  if (!existing) throw new Error("Crawl tidak ditemukan.");

  await prisma.seoSiteCrawl.update({
    where: { id: crawlId },
    data: {
      status: "PENDING",
      dataforseoTaskId: null,
      pagesCrawled: 0,
      errorMessage: null,
      dataNotice: null,
    },
  });

  after(async () => {
    try {
      await startSiteCrawl(crawlId);
      revalidatePath(`/seo/crawler/${crawlId}`);
    } catch (err) {
      console.error("[refreshSeoSiteCrawl] gagal", err);
    }
  });

  revalidatePath("/seo/crawler");
  revalidatePath(`/seo/crawler/${crawlId}`);
}

export async function deleteSeoSiteCrawl(crawlId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(crawlId);

  await prisma.seoSiteCrawl.delete({ where: { id: crawlId } });
  revalidatePath("/seo/crawler");
}

/* --------------------------- jadwal crawl berulang --------------------------- */

const scheduleSchema = z.object({
  domain: z.string().min(3).max(200),
  maxPages: z.number().int().min(1).max(1000).optional(),
  includeLighthouse: z.boolean().optional(),
  frequency: z.nativeEnum(SeoCrawlFrequency).optional(),
});

export async function createSeoCrawlSchedule(
  input: z.infer<typeof scheduleSchema>,
) {
  const session = await requireSeoAccess();
  const data = scheduleSchema.parse(input);
  const domain = normalizeDomain(data.domain);
  if (!domain) throw new Error("Domain tidak valid.");

  const schedule = await prisma.seoCrawlSchedule.create({
    data: {
      domain,
      maxPages: data.maxPages ?? 100,
      includeLighthouse: data.includeLighthouse ?? false,
      frequency: data.frequency ?? SeoCrawlFrequency.WEEKLY,
      // Jalankan pada cron berikutnya.
      nextRunAt: new Date(),
      createdById: session.user.id,
    },
  });

  revalidatePath("/seo/crawler");
  return { id: schedule.id };
}

export async function toggleSeoCrawlSchedule(
  scheduleId: string,
  isActive: boolean,
) {
  await requireSeoAccess();
  z.string().min(1).parse(scheduleId);
  z.boolean().parse(isActive);
  await prisma.seoCrawlSchedule.update({
    where: { id: scheduleId },
    data: { isActive },
  });
  revalidatePath("/seo/crawler");
}

export async function deleteSeoCrawlSchedule(scheduleId: string) {
  await requireSeoAccess();
  z.string().min(1).parse(scheduleId);
  await prisma.seoCrawlSchedule.delete({ where: { id: scheduleId } });
  revalidatePath("/seo/crawler");
}
