"use server";

import { revalidatePath } from "next/cache";
import { SocialListeningStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBrandManager } from "@/lib/brand-research/auth";
import { brandStudioBrandFilter } from "@/lib/brand-research/brand-studio-scope";
import {
  enqueueBrandAdLibraryScrape,
  generateAdLibraryAiSummary,
  getBrandAdLibraryMonitorDetail,
  listBrandAdLibraryMonitors,
} from "@/lib/brand-research/scrape-meta-ads";

const createMonitorSchema = z.object({
  name: z.string().min(1),
  searchTerms: z.array(z.string()).default([]),
  adLibraryUrls: z.array(z.string()).default([]),
  country: z.string().default("ID"),
  activeStatus: z.string().default("active"),
  adType: z.string().default("all"),
  mediaType: z.enum(["all", "image", "video"]).default("all"),
  searchType: z.string().default("keyword_exact_phrase"),
  maxAds: z.number().int().min(10).max(200).default(50),
  ownerBrandId: z.string().optional().nullable(),
});

export async function createBrandAdLibraryMonitor(
  input: z.input<typeof createMonitorSchema>,
) {
  const session = await requireBrandManager();
  const data = createMonitorSchema.parse(input);

  const searchTerms = data.searchTerms.map((t) => t.trim()).filter(Boolean);
  const adLibraryUrls = data.adLibraryUrls.map((u) => u.trim()).filter(Boolean);
  if (searchTerms.length === 0 && adLibraryUrls.length === 0) {
    throw new Error("Isi minimal satu keyword atau URL Ad Library.");
  }

  const monitor = await prisma.brandAdLibraryMonitor.create({
    data: {
      name: data.name.trim(),
      searchTerms,
      adLibraryUrls,
      country: data.country || "ID",
      activeStatus: data.activeStatus,
      adType: data.adType,
      mediaType: data.mediaType,
      searchType: data.searchType,
      maxAds: data.maxAds,
      ownerBrandId: data.ownerBrandId ?? null,
      createdById: session.user.id,
    },
  });

  await enqueueBrandAdLibraryScrape(monitor.id);

  revalidatePath("/brand-hub/ad-library");
  return { id: monitor.id };
}

export async function refreshBrandAdLibraryMonitor(monitorId: string) {
  await requireBrandManager();
  const result = await enqueueBrandAdLibraryScrape(monitorId);
  revalidatePath("/brand-hub/ad-library");
  revalidatePath(`/brand-hub/ad-library/${monitorId}`);
  return result;
}

export async function deleteBrandAdLibraryMonitor(monitorId: string) {
  await requireBrandManager();
  const inFlight = await prisma.brandAdLibraryBatch.findFirst({
    where: {
      monitorId,
      status: {
        in: [SocialListeningStatus.PENDING, SocialListeningStatus.COLLECTING],
      },
    },
    select: { id: true },
  });
  if (inFlight) {
    throw new Error("Scrape masih berjalan — tunggu selesai sebelum menghapus monitor.");
  }
  await prisma.brandAdLibraryMonitor.delete({ where: { id: monitorId } });
  revalidatePath("/brand-hub/ad-library");
}

export async function fetchBrandAdLibraryMonitors(ownerBrandId?: string | null) {
  await requireBrandManager();
  return listBrandAdLibraryMonitors(ownerBrandId);
}

export async function fetchBrandAdLibraryMonitor(
  monitorId: string,
  ownerBrandId?: string | null,
) {
  await requireBrandManager();
  const monitor = await getBrandAdLibraryMonitorDetail(monitorId, ownerBrandId);
  if (!monitor) throw new Error("Monitor tidak ditemukan.");
  return monitor;
}

export async function regenerateBrandAdLibraryAiSummary(monitorId: string) {
  await requireBrandManager();
  const monitor = await prisma.brandAdLibraryMonitor.findUnique({
    where: { id: monitorId },
    include: { _count: { select: { ads: true } } },
  });
  if (!monitor) throw new Error("Monitor tidak ditemukan.");
  if (monitor._count.ads === 0) {
    throw new Error("Belum ada iklan — refresh monitor dulu.");
  }
  await generateAdLibraryAiSummary(monitorId);
  revalidatePath(`/brand-hub/ad-library/${monitorId}`);
  return { ok: true };
}
