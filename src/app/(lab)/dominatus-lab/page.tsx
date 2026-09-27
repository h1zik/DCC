import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ensureLabPage } from "@/lib/lab-access";
import { DominatusLabClient } from "./dominatus-lab-client";

export const metadata: Metadata = {
  title: "Dominatus Lab",
};

/** Rentang [sekarang, sekarang + n hari) untuk hitungan jadwal KOL mendatang. */
function nextDaysWindow(days: number) {
  const now = new Date();
  return { gte: now, lt: new Date(now.getTime() + days * 24 * 60 * 60 * 1000) };
}

export default async function DominatusLabPage() {
  const { session, access } = await ensureLabPage();

  // Statistik ringan: hanya count() agar halaman launcher tetap cepat.
  const c = (p: Promise<number>) => p.catch(() => 0);
  const [
    brandStrategies,
    brandVisualAssets,
    researchReports,
    researchCompetitors,
    seoKeywords,
    seoTracked,
    contentIdeas,
    contentIdeaSets,
    kolActive,
    kolUpcoming,
  ] = await Promise.all([
    c(prisma.brandStrategyDocument.count()),
    c(prisma.brandVisualAsset.count()),
    c(prisma.researchReport.count({ where: { status: "READY" } })),
    c(prisma.researchCompetitor.count()),
    c(prisma.seoKeyword.count()),
    c(prisma.seoTrackedKeyword.count()),
    c(prisma.contentStudioIdea.count()),
    c(prisma.contentStudioIdeaSet.count({ where: { status: "READY" } })),
    c(prisma.kolProfile.count({ where: { status: "ACTIVE" } })),
    c(
      prisma.kolSchedule.count({
        where: {
          status: { in: ["APPROVED", "SCHEDULED"] },
          scheduledAt: nextDaysWindow(14),
        },
      }),
    ),
  ]);

  return (
    <DominatusLabClient
      userName={session.user.name ?? null}
      access={access}
      stats={{
        brandStrategies,
        brandVisualAssets,
        researchReports,
        researchCompetitors,
        seoKeywords,
        seoTracked,
        contentIdeas,
        contentIdeaSets,
        kolActive,
        kolUpcoming,
      }}
    />
  );
}
