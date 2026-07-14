import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canAccessResearchHub,
  isBrandManager,
  isMarketAnalystOrStudio,
} from "@/lib/roles";
import { DominatusLabClient } from "./dominatus-lab-client";

export const metadata: Metadata = {
  title: "Dominatus Lab",
};

export default async function DominatusLabPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (!isMarketAnalystOrStudio(role)) redirect("/home");

  const access = {
    brandHub: isBrandManager(role),
    researchHub: canAccessResearchHub(role),
    seo: canAccessResearchHub(role),
    contentStudio: isMarketAnalystOrStudio(role),
  };

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
  ] = await Promise.all([
    c(prisma.brandStrategyDocument.count()),
    c(prisma.brandVisualAsset.count()),
    c(prisma.researchReport.count({ where: { status: "READY" } })),
    c(prisma.researchCompetitor.count()),
    c(prisma.seoKeyword.count()),
    c(prisma.seoTrackedKeyword.count()),
    c(prisma.contentStudioIdea.count()),
    c(prisma.contentStudioIdeaSet.count({ where: { status: "READY" } })),
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
      }}
    />
  );
}
