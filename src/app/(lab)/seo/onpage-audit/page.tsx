import { ListChecks } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import { OnPageAuditClient, type AuditRow } from "./onpage-audit-client";

export default async function SeoOnPageAuditPage() {
  const audits = await prisma.seoOnPageAudit.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      targetKeyword: true,
      status: true,
      score: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  const rows: AuditRow[] = audits.map((a) => ({
    id: a.id,
    url: a.url,
    targetKeyword: a.targetKeyword,
    status: a.status,
    score: a.score,
    errorMessage: a.errorMessage,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <SeoModulePage
      icon={ListChecks}
      title="On-Page SEO Audit"
      description="Audit satu URL: title, meta, heading, alt text, link, word count, schema, dan readability → skor + rekomendasi actionable (Bahasa Indonesia)."
    >
      <OnPageAuditClient audits={rows} />
    </SeoModulePage>
  );
}
