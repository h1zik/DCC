"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus, SeoIssueSeverity } from "@prisma/client";
import { ListChecks, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SeoDetailPage } from "@/components/seo/seo-module-page";
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import { LabEmptyState, lab } from "@/components/lab/lab-primitives";
import {
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

/** Segmen bar distribusi severity isu (urut paling parah). */
const SEVERITY_SEGMENTS: { key: SeoIssueSeverity; dot: string }[] = [
  { key: SeoIssueSeverity.CRITICAL, dot: "bg-red-500" },
  { key: SeoIssueSeverity.HIGH, dot: "bg-rose-400" },
  { key: SeoIssueSeverity.MEDIUM, dot: "bg-amber-400" },
  { key: SeoIssueSeverity.LOW, dot: "bg-slate-400 dark:bg-slate-500" },
  { key: SeoIssueSeverity.INFO, dot: "bg-muted-foreground/25" },
];

/** Tone pill tinted per severity (selaras dot segmen). */
const SEVERITY_TONES: Record<SeoIssueSeverity, string> = {
  CRITICAL: "bg-red-500/15 text-red-700 dark:text-red-300",
  HIGH: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  MEDIUM: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  LOW: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  INFO: "bg-muted/70 text-muted-foreground",
};

function SeverityPill({ severity }: { severity: SeoIssueSeverity }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-lg px-2 py-1 text-[11px] font-bold",
        SEVERITY_TONES[severity],
      )}
    >
      {SEO_SEVERITY_LABELS[severity]}
    </span>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
        {label}
      </p>
      <p className="text-foreground mt-0.5 truncate text-sm font-extrabold tabular-nums tracking-tight">
        {value}
      </p>
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

  const severityCounts = audit.issues.reduce<Record<SeoIssueSeverity, number>>(
    (acc, issue) => {
      acc[issue.severity] += 1;
      return acc;
    },
    { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
  );
  const issueTotal = audit.issues.length || 1;
  const urgentCount = severityCounts.CRITICAL + severityCounts.HIGH;

  const hasSide =
    recs.length > 0 ||
    !!audit.aiRecommendations?.readabilityNote ||
    audit.headings != null;

  return (
    <SeoDetailPage
      icon={ListChecks}
      backHref="/seo/onpage-audit"
      title="Audit On-Page"
      description={
        audit.targetKeyword
          ? `${audit.url} · keyword target: ${audit.targetKeyword}`
          : audit.url
      }
      right={
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      }
    >
      {audit.status === SeoAnalysisStatus.FAILED && audit.errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {audit.errorMessage}
        </div>
      ) : null}
      {audit.dataNotice ? (
        <div className={cn(lab.nestedPanel, "text-muted-foreground text-sm")}>
          {audit.dataNotice}
        </div>
      ) : null}

      {busy ? (
        <LabEmptyState
          icon={ListChecks}
          title="Sedang mengaudit…"
          description="Mengambil & menganalisis halaman. Halaman ter-update otomatis."
        />
      ) : (
        <>
          {/* Papan bento: skor, distribusi severity, stat */}
          <div className="grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4">
            {/* Skor — tile hero dengan tone skor */}
            <div className="bento-tile col-span-2 row-span-2 lg:col-span-1">
              <span className="bento-label">Skor On-Page</span>
              <span
                className={cn(
                  "bento-value text-5xl",
                  scoreToneClass(audit.score),
                )}
              >
                {audit.score ?? "—"}
                {audit.score != null ? (
                  <span className="text-muted-foreground/50 text-2xl font-bold">
                    /100
                  </span>
                ) : null}
              </span>
              <span className="text-muted-foreground text-[11px] font-medium leading-snug">
                gabungan title, meta, heading, link, alt, schema & readability
              </span>
            </div>

            {/* Distribusi severity */}
            <div className="bento-tile col-span-2 row-span-2 justify-start gap-3">
              <div className="flex items-center justify-between">
                <span className="bento-label">Distribusi isu</span>
                <span className="text-muted-foreground text-[11px] tabular-nums">
                  {audit.issues.length} isu
                </span>
              </div>
              {audit.issues.length === 0 ? (
                <p className="text-muted-foreground m-auto text-sm">
                  Tidak ada isu terdeteksi — halaman sudah rapi.
                </p>
              ) : (
                <>
                  <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
                    {SEVERITY_SEGMENTS.map((seg) => {
                      const count = severityCounts[seg.key];
                      if (count === 0) return null;
                      return (
                        <div
                          key={seg.key}
                          className={seg.dot}
                          style={{ width: `${(count / issueTotal) * 100}%` }}
                          title={`${SEO_SEVERITY_LABELS[seg.key]}: ${count}`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {SEVERITY_SEGMENTS.map((seg) => {
                      const count = severityCounts[seg.key];
                      return (
                        <div
                          key={seg.key}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span
                            className={cn("size-2 shrink-0 rounded-full", seg.dot)}
                            aria-hidden
                          />
                          <span className="text-muted-foreground flex-1">
                            {SEO_SEVERITY_LABELS[seg.key]}
                          </span>
                          <span className="font-semibold tabular-nums">
                            {count}
                          </span>
                          <span className="text-muted-foreground w-10 text-right text-[11px] tabular-nums">
                            {Math.round((count / issueTotal) * 100)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Isu terdeteksi */}
            <div className="bento-tile">
              <span className="bento-label">Isu terdeteksi</span>
              <span className="bento-value">{audit.issues.length}</span>
              <span
                className={cn(
                  "text-[11px] font-medium",
                  urgentCount > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-muted-foreground",
                )}
              >
                {urgentCount > 0
                  ? `${urgentCount} kritis/tinggi perlu ditangani`
                  : "tidak ada isu mendesak"}
              </span>
            </div>

            {/* Word count */}
            <div className="bento-tile">
              <span className="bento-label">Word count</span>
              <span className="bento-value">{num(s.wordCount)}</span>
              <span className="text-muted-foreground text-[11px] font-medium">
                kata pada konten utama
              </span>
            </div>
          </div>

          {/* Sinyal halaman */}
          <div className="bento-tile justify-start gap-3">
            <span className="bento-label">Sinyal halaman</span>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <MiniStat
                label="Title"
                value={s.titleLength ? `${s.titleLength} kar.` : "—"}
              />
              <MiniStat
                label="Meta description"
                value={s.descriptionLength ? `${s.descriptionLength} kar.` : "—"}
              />
              <MiniStat label="Link internal" value={num(s.internalLinks)} />
              <MiniStat label="Link eksternal" value={num(s.externalLinks)} />
              <MiniStat label="Gambar" value={num(s.imagesCount)} />
              <MiniStat
                label="Gambar tanpa alt"
                value={num(s.imagesWithoutAlt)}
              />
              <MiniStat label="Word count" value={num(s.wordCount)} />
              <MiniStat
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
          <div className="grid items-start gap-3 lg:grid-cols-2">
            <div
              className={cn(
                "bento-tile justify-start gap-3",
                !hasSide && "lg:col-span-2",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="bento-label">Isu terdeteksi</span>
                <span className="text-muted-foreground text-[11px] tabular-nums">
                  {audit.issues.length} isu
                </span>
              </div>
              {audit.issues.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Tidak ada isu mayor. 🎉
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {audit.issues.map((issue, i) => (
                    <li
                      key={`${issue.type}-${i}`}
                      className="border-border/40 flex items-start gap-2.5 border-b pb-2 last:border-0"
                    >
                      <SeverityPill severity={issue.severity} />
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

            {hasSide ? (
              <div className="flex flex-col gap-3">
                {recs.length > 0 || audit.aiRecommendations?.readabilityNote ? (
                  <div className="bento-tile justify-start gap-3">
                    <span className="bento-label inline-flex items-center gap-1.5">
                      <Sparkles className="size-3.5" aria-hidden />
                      Rekomendasi AI
                    </span>
                    {audit.aiRecommendations?.readabilityNote ? (
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        <span className="text-foreground font-medium">
                          Keterbacaan:{" "}
                        </span>
                        {audit.aiRecommendations.readabilityNote}
                      </p>
                    ) : null}
                    {recs.length > 0 ? (
                      <ul className="flex flex-col gap-2">
                        {recs.map((r, i) => (
                          <li key={i} className="text-sm">
                            <span className="font-medium">{r.title}</span>
                            {r.detail ? (
                              <span className="text-muted-foreground">
                                {" "}
                                — {r.detail}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

                {audit.headings ? (
                  <div className="bento-tile justify-start gap-3">
                    <span className="bento-label">Struktur heading</span>
                    <div className="flex flex-col gap-1 text-sm">
                      {(["h1", "h2", "h3", "h4", "h5", "h6"] as const).map(
                        (h) => {
                          const list = audit.headings?.[h] ?? [];
                          if (list.length === 0) return null;
                          return (
                            <div key={h} className="flex gap-2">
                              <span className="text-muted-foreground w-8 shrink-0 text-xs font-bold uppercase leading-5 tabular-nums">
                                {h}
                                <span className="text-muted-foreground/60 ml-0.5 font-semibold">
                                  ×{list.length}
                                </span>
                              </span>
                              <span className="min-w-0 flex-1 truncate">
                                {list.slice(0, 3).join(" · ")}
                                {list.length > 3
                                  ? ` … (+${list.length - 3})`
                                  : ""}
                              </span>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      )}
    </SeoDetailPage>
  );
}
