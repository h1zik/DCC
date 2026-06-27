"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
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
