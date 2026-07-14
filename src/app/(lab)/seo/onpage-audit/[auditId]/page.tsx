import { notFound } from "next/navigation";
import { SeoIssueSeverity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  OnPageAuditDetailClient,
  type AuditDetail,
} from "./onpage-audit-detail-client";

type RawIssue = {
  type?: string;
  severity?: string;
  message?: string;
  recommendation?: string;
};

function parseIssues(raw: unknown): AuditDetail["issues"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i): i is RawIssue => !!i && typeof i === "object")
    .map((i) => ({
      type: String(i.type ?? ""),
      severity: (Object.values(SeoIssueSeverity) as string[]).includes(
        String(i.severity),
      )
        ? (i.severity as SeoIssueSeverity)
        : SeoIssueSeverity.INFO,
      message: String(i.message ?? ""),
      recommendation: String(i.recommendation ?? ""),
    }));
}

export default async function SeoOnPageAuditDetailPage({
  params,
}: {
  params: Promise<{ auditId: string }>;
}) {
  const { auditId } = await params;

  const audit = await prisma.seoOnPageAudit.findUnique({
    where: { id: auditId },
  });
  if (!audit) notFound();

  const detail: AuditDetail = {
    id: audit.id,
    url: audit.url,
    targetKeyword: audit.targetKeyword,
    status: audit.status,
    score: audit.score,
    signals: (audit.signals as Record<string, unknown> | null) ?? null,
    headings: (audit.headings as Record<string, string[]> | null) ?? null,
    issues: parseIssues(audit.issues),
    aiRecommendations:
      (audit.aiRecommendations as AuditDetail["aiRecommendations"]) ?? null,
    dataNotice: audit.dataNotice,
    errorMessage: audit.errorMessage,
  };

  return <OnPageAuditDetailClient audit={detail} />;
}
