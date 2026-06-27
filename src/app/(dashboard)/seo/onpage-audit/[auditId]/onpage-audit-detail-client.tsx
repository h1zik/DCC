"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus, SeoIssueSeverity } from "@prisma/client";
import { ArrowLeft, ListChecks, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SeoDetailPage } from "@/components/seo/seo-module-page";
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import {
  ResearchHubEmptyState,
  hub,
} from "@/components/research-hub/research-hub-primitives";
import {
  SEO_SEVERITY_BADGE,
  SEO_SEVERITY_LABELS,
  isSeoStatusBusy,
  scoreToneClass,
} from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import { refreshSeoOnPageAudit } from "@/actions/seo-onpage-audit";
import { cn } from "@/lib/utils";

export type AuditDetail = {
  id: string;
  url: string;
  targetKeyword: string | null;
  status: SeoAnalysisStatus;
  score: number | null;
  signals: Record<string, unknown> | null;
  headings: Record<string, string[]> | null;
  issues: {
    type: string;
    severity: SeoIssueSeverity;
    message: string;
    recommendation: string;
  }[];
  aiRecommendations: {
    recommendations?: { title: string; detail: string; priority: string }[];
    readabilityNote?: string | null;
  } | null;
  dataNotice: string | null;
  errorMessage: string | null;
};

function SignalRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 py-1.5 last:border-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function num(value: unknown): React.ReactNode {
  return typeof value === "number" ? value.toLocaleString("id-ID") : "—";
}

export function OnPageAuditDetailClient({ audit }: { audit: AuditDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);

  const busy = isSeoStatusBusy(audit.status);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [busy, router]);

  function handleRefresh() {
    setRefreshing(true);
    startTransition(async () => {
      try {
        await refreshSeoOnPageAudit(audit.id);
        toast.success("Audit ulang dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh."));
      } finally {
        setRefreshing(false);
      }
    });
  }

  const s = audit.signals ?? {};
  const schemaTypes = Array.isArray(s.schemaTypes) ? (s.schemaTypes as string[]) : [];
  const recs = audit.aiRecommendations?.recommendations ?? [];

  return (
    <SeoDetailPage
      icon={ListChecks}
      title="Audit On-Page"
      description={audit.url}
      right={
        <div className="flex items-center gap-2">
          <SeoStatusBadge status={audit.status} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={pending || refreshing || busy}
          >
            <RefreshCw className={cn(refreshing && "animate-spin")} />
            Audit ulang
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/seo/onpage-audit" />}>
            <ArrowLeft />
            Kembali
          </Button>
        </div>
      }
    >
      {audit.status === SeoAnalysisStatus.FAILED && audit.errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {audit.errorMessage}
        </div>
      ) : null}
      {audit.dataNotice ? (
        <div className={cn(hub.nestedPanel, "text-muted-foreground text-sm")}>
          {audit.dataNotice}
        </div>
      ) : null}

      {busy ? (
        <ResearchHubEmptyState
          icon={ListChecks}
          title="Sedang mengaudit…"
          description="Mengambil & menganalisis halaman. Halaman ter-update otomatis."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          {/* Skor + sinyal */}
          <div className="flex flex-col gap-4">
            <div className={cn(hub.card, "flex flex-col items-center gap-1 p-5")}>
              <span className="text-muted-foreground text-xs uppercase tracking-wide">
                Skor On-Page
              </span>
              <span
                className={cn(
                  "text-5xl font-bold tabular-nums",
                  scoreToneClass(audit.score),
                )}
              >
                {audit.score ?? "—"}
              </span>
              <span className="text-muted-foreground text-xs">dari 100</span>
            </div>

            <div className={cn(hub.card, "p-4")}>
              <p className={cn(hub.label, "mb-2")}>Sinyal</p>
              <SignalRow
                label="Title"
                value={s.titleLength ? `${s.titleLength} kar.` : "—"}
              />
              <SignalRow
                label="Meta description"
                value={s.descriptionLength ? `${s.descriptionLength} kar.` : "—"}
              />
              <SignalRow label="Word count" value={num(s.wordCount)} />
              <SignalRow label="Link internal" value={num(s.internalLinks)} />
              <SignalRow label="Link eksternal" value={num(s.externalLinks)} />
              <SignalRow label="Gambar" value={num(s.imagesCount)} />
              <SignalRow
                label="Gambar tanpa alt"
                value={num(s.imagesWithoutAlt)}
              />
              <SignalRow
                label="Schema markup"
                value={
                  schemaTypes.length > 0
                    ? schemaTypes.slice(0, 3).join(", ")
                    : s.hasSchema === true
                      ? "Ada"
                      : "Tidak ada"
                }
              />
            </div>
          </div>

          {/* Isu + rekomendasi */}
          <div className="flex flex-col gap-5">
            <div className={cn(hub.card, "p-4")}>
              <p className="mb-3 font-semibold">
                Isu terdeteksi ({audit.issues.length})
              </p>
              {audit.issues.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Tidak ada isu mayor. 🎉
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {audit.issues.map((issue, i) => (
                    <li
                      key={`${issue.type}-${i}`}
                      className="flex items-start gap-2 border-b border-border/40 pb-2 last:border-0"
                    >
                      <Badge variant={SEO_SEVERITY_BADGE[issue.severity]}>
                        {SEO_SEVERITY_LABELS[issue.severity]}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{issue.message}</p>
                        {issue.recommendation ? (
                          <p className="text-muted-foreground text-xs">
                            {issue.recommendation}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {recs.length > 0 || audit.aiRecommendations?.readabilityNote ? (
              <div className={hub.panel}>
                <p className={cn(hub.label, "mb-2")}>Rekomendasi AI</p>
                {audit.aiRecommendations?.readabilityNote ? (
                  <p className="text-muted-foreground mb-3 text-sm leading-relaxed">
                    <span className="font-medium text-foreground">
                      Keterbacaan:{" "}
                    </span>
                    {audit.aiRecommendations.readabilityNote}
                  </p>
                ) : null}
                <ul className="flex flex-col gap-2">
                  {recs.map((r, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-medium">{r.title}</span>
                      {r.detail ? (
                        <span className="text-muted-foreground"> — {r.detail}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {audit.headings ? (
              <div className={cn(hub.card, "p-4")}>
                <p className="mb-2 font-semibold">Struktur heading</p>
                <div className="flex flex-col gap-1 text-sm">
                  {(["h1", "h2", "h3", "h4", "h5", "h6"] as const).map((h) => {
                    const list = audit.headings?.[h] ?? [];
                    if (list.length === 0) return null;
                    return (
                      <div key={h} className="flex gap-2">
                        <span className="text-muted-foreground w-8 shrink-0 uppercase">
                          {h}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {list.slice(0, 3).join(" · ")}
                          {list.length > 3 ? ` … (+${list.length - 3})` : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </SeoDetailPage>
  );
}
