import { ListChecks } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isSeoStatusBusy } from "@/lib/seo/labels";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import {
  OnPageAuditClient,
  type AuditListSummary,
  type AuditRow,
} from "./onpage-audit-client";

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

  // Agregat ringkasan — dihitung dari rows yang sudah diambil (tanpa query baru).
  const scores = rows
    .filter((r) => r.status === "READY" && r.score != null)
    .map((r) => r.score as number);
  const summary: AuditListSummary = {
    total: rows.length,
    ready: rows.filter((r) => r.status === "READY").length,
    busy: rows.filter((r) => isSeoStatusBusy(r.status)).length,
    failed: rows.filter((r) => r.status === "FAILED").length,
    avgScore: scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null,
    bestScore: scores.length ? Math.max(...scores) : null,
    lastCreatedAt: rows[0]?.createdAt ?? null,
  };

  return (
    <SeoModulePage
      icon={ListChecks}
      title="On-Page SEO Audit"
      description="Audit satu URL: title, meta, heading, alt text, link, word count, schema, dan readability → skor + rekomendasi actionable (Bahasa Indonesia)."
    >
      <OnPageAuditClient audits={rows} summary={summary} />
    </SeoModulePage>
  );
}
