"use server";

import { InfluencerPlatform, InfluencerTier, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireKolApprover, requireKolUser } from "@/lib/kol/auth";
import { logKolAudit } from "@/lib/kol/audit";
import {
  enqueueKolPostSync,
  pollRunningKolPostSyncs,
  recomputeScheduleMetrics,
} from "@/lib/kol/post-sync";
import { ensureKolRateDefaults, getKolRateSettings } from "@/lib/kol/rate-context";
import { prisma } from "@/lib/prisma";

/** Ambil ulang metrik satu jadwal sekarang juga (abaikan "sudah hari ini"). */
export async function syncSchedulePostNow(scheduleId: string) {
  await requireKolUser();
  const res = await enqueueKolPostSync({ scheduleIds: [scheduleId], force: true });
  if (res.schedules === 0) {
    throw new Error(
      "Jadwal ini belum bisa disinkron — pastikan statusnya Tayang dan link post valid, atau sinkronisasi sebelumnya masih berjalan.",
    );
  }
  revalidatePath(`/kol-hub/schedules/${scheduleId}`);
  return res;
}

/**
 * Dipanggil halaman detail selama sinkronisasi berjalan: majukan run Apify
 * (tanpa menunggu cron) dan laporkan apakah jadwal ini masih diproses.
 */
export async function pollKolPostSync(scheduleId: string): Promise<{ inFlight: boolean }> {
  await requireKolUser();
  await pollRunningKolPostSyncs();
  const inFlight = await prisma.kolPostSyncRun.count({
    where: { status: { in: ["QUEUED", "RUNNING"] }, scheduleIds: { has: scheduleId } },
  });
  return { inFlight: inFlight > 0 };
}

/** Sinkron semua post tayang yang belum diambil hari ini. */
export async function syncAllDuePosts() {
  await requireKolUser();
  const res = await enqueueKolPostSync();
  revalidatePath("/kol-hub/schedules");
  return res;
}

const configSchema = z.object({
  platform: z.enum(["INSTAGRAM", "TIKTOK"]),
  floorPct: z.number().int().min(50).max(95),
  ceilingPct: z.number().int().min(105).max(200),
  fypThreshold: z.number().int().min(10_000).max(100_000_000),
  trackingDays: z.number().int().min(3).max(90),
  cpm: z.record(
    z.enum(["NANO", "MICRO", "MID", "MACRO", "MEGA"]),
    z.number().min(1_000).max(500_000),
  ),
});

/** Simpan aturan rate card & FYP satu platform (khusus approver). */
export async function saveKolPlatformSettings(input: z.input<typeof configSchema>) {
  const session = await requireKolApprover();
  const data = configSchema.parse(input);
  await ensureKolRateDefaults();
  const before = await getKolRateSettings();
  const platform = data.platform as InfluencerPlatform;

  await prisma.$transaction([
    prisma.kolPlatformConfig.update({
      where: { platform },
      data: {
        floorPct: data.floorPct,
        ceilingPct: data.ceilingPct,
        fypThreshold: data.fypThreshold,
        trackingDays: data.trackingDays,
      },
    }),
    ...Object.entries(data.cpm).map(([tier, cpm]) =>
      prisma.kolReferenceCpm.update({
        where: { platform_tier: { platform, tier: tier as InfluencerTier } },
        data: { cpm: new Prisma.Decimal(cpm) },
      }),
    ),
  ]);

  // Ambang FYP berubah → status FYP jadwal di platform ini ikut dihitung ulang.
  if (before.configs[data.platform].fypThreshold !== data.fypThreshold) {
    const ids = await prisma.kolSchedule.findMany({
      where: { socialAccount: { platform }, snapshots: { some: {} } },
      select: { id: true },
    });
    for (const s of ids) await recomputeScheduleMetrics(s.id, data.fypThreshold);
  }

  await logKolAudit(prisma, {
    actorId: session.user.id,
    entityType: "settings",
    entityId: `platform:${data.platform}`,
    action: "settings.rate_card",
    meta: data as unknown as Prisma.InputJsonValue,
  });
  revalidatePath("/kol-hub", "layout");
}
