import { Globe } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import {
  DomainOverviewClient,
  type DomainOverviewRow,
} from "./domain-overview-client";

export default async function SeoDomainOverviewPage() {
  const rows = await prisma.seoDomainOverview.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      target: true,
      status: true,
      overview: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  const items: DomainOverviewRow[] = rows.map((r) => {
    const overview =
      r.overview && typeof r.overview === "object" && !Array.isArray(r.overview)
        ? (r.overview as { organicTraffic?: number; organicKeywords?: number })
        : null;
    return {
      id: r.id,
      target: r.target,
      status: r.status,
      organicTraffic: overview?.organicTraffic ?? null,
      organicKeywords: overview?.organicKeywords ?? null,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt.toISOString(),
    };
  });

  return (
    <SeoModulePage
      icon={Globe}
      title="Domain Overview"
      description="Potret organik satu domain ala Semrush: estimasi trafik, jumlah keyword per posisi, top keywords, dan kompetitor organik yang terdeteksi otomatis."
    >
      <DomainOverviewClient items={items} />
    </SeoModulePage>
  );
}
