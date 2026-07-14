import { Activity } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ensureSeoPage } from "@/lib/seo/auth";
import { isGscConfigured } from "@/lib/seo/gsc/client";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import {
  ContentAuditClient,
  type ContentAuditListRow,
} from "./content-audit-client";

export default async function SeoContentAuditPage() {
  await ensureSeoPage();

  const audits = await prisma.seoContentAudit.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const items: ContentAuditListRow[] = audits.map((a) => ({
    id: a.id,
    siteUrl: a.siteUrl,
    status: a.status,
    windowDays: a.windowDays,
    rows: Array.isArray(a.rows)
      ? (a.rows as ContentAuditListRow["rows"])
      : [],
    summary:
      a.summary && typeof a.summary === "object" && !Array.isArray(a.summary)
        ? (a.summary as ContentAuditListRow["summary"])
        : null,
    dataNotice: a.dataNotice,
    errorMessage: a.errorMessage,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <SeoModulePage
      icon={Activity}
      title="Content Audit"
      description="Data nyata Google Search Console: halaman mana yang trafiknya menurun (decay) dan perlu di-refresh — dibandingkan 28 hari vs 28 hari sebelumnya."
    >
      <ContentAuditClient items={items} gscConfigured={isGscConfigured()} />
    </SeoModulePage>
  );
}
