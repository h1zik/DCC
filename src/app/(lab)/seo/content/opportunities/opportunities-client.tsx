"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  SeoKeywordIntent,
  SeoOpportunityStage,
  SeoOpportunityType,
} from "@prisma/client";
import {
  ExternalLink,
  FileText,
  Lightbulb,
  Loader2,
  PenLine,
  RefreshCw,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import { LabEmptyState, lab } from "@/components/lab/lab-primitives";
import { SEO_INTENT_LABELS, scoreToneClass } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createBriefFromOpportunity,
  dismissOpportunity,
  refreshOpportunitiesAction,
  restoreOpportunity,
} from "@/actions/seo-content-opportunities";
import { cn } from "@/lib/utils";

export type OpportunityRow = {
  id: string;
  keyword: string;
  type: SeoOpportunityType;
  stage: SeoOpportunityStage;
  searchVolume: number | null;
  difficulty: number | null;
  intent: SeoKeywordIntent;
  opportunityScore: number;
  clusterLabel: string | null;
  currentPosition: number | null;
  targetUrl: string | null;
  suggestedTitle: string | null;
  angle: string | null;
  publishedUrl: string | null;
  briefId: string | null;
  draftId: string | null;
  lastRefreshedAt: string;
};

const STAGE_LABELS: Record<SeoOpportunityStage, string> = {
  IDEA: "Ide",
  BRIEFED: "Brief",
  DRAFTED: "Draft",
  PUBLISHED: "Terbit",
  DISMISSED: "Diabaikan",
};

/** Pill tinted per tahap pipeline (ide → terbit). */
const STAGE_PILL: Record<SeoOpportunityStage, string> = {
  IDEA: "bg-muted text-muted-foreground",
  BRIEFED: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  DRAFTED: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  PUBLISHED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  DISMISSED: "bg-muted text-muted-foreground",
};

type Filter = "all" | "new" | "optimize" | "dismissed";

function num(v: number | null): string {
  return v == null ? "—" : v.toLocaleString("id-ID");
}

function CardStat({
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

export function OpportunitiesClient({ items }: { items: OpportunityRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  /* ------------------------------ Statistik pipeline ------------------------------ */
  const summary = useMemo(() => {
    const active = items.filter((i) => i.stage !== "DISMISSED");
    const stageCount = (stage: SeoOpportunityStage) =>
      active.filter((i) => i.stage === stage).length;
    return {
      active: active.length,
      newArticles: active.filter((i) => i.type === "NEW_ARTICLE").length,
      optimize: active.filter((i) => i.type === "OPTIMIZE_EXISTING").length,
      bestScore: active.length
        ? Math.round(Math.max(...active.map((i) => i.opportunityScore)))
        : null,
      pipeline: [
        ["Ide", stageCount("IDEA")],
        ["Brief", stageCount("BRIEFED")],
        ["Draft", stageCount("DRAFTED")],
        ["Terbit", stageCount("PUBLISHED")],
      ] as const,
    };
  }, [items]);

  const visible = useMemo(() => {
    return items.filter((i) => {
      if (filter === "dismissed") return i.stage === "DISMISSED";
      if (i.stage === "DISMISSED") return false;
      if (filter === "new") return i.type === "NEW_ARTICLE";
      if (filter === "optimize") return i.type === "OPTIMIZE_EXISTING";
      return true;
    });
  }, [items, filter]);

  const clusters = useMemo(() => {
    const map = new Map<string, OpportunityRow[]>();
    for (const item of visible) {
      const key = item.clusterLabel ?? "Lainnya";
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()].sort(
      (a, b) =>
        Math.max(...b[1].map((i) => i.opportunityScore)) -
        Math.max(...a[1].map((i) => i.opportunityScore)),
    );
  }, [visible]);

  function handleRefresh() {
    setRefreshing(true);
    startTransition(async () => {
      try {
        await refreshOpportunitiesAction();
        toast.success(
          "Refresh dimulai — feed ter-update dari riset keyword & rank tracker.",
        );
        setTimeout(() => {
          router.refresh();
          setRefreshing(false);
        }, 4000);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh."));
        setRefreshing(false);
      }
    });
  }

  function handleCreateBrief(item: OpportunityRow) {
    setActingId(item.id);
    startTransition(async () => {
      try {
        const { briefId } = await createBriefFromOpportunity(item.id);
        toast.success("Brief dibuat — riset SERP berjalan.");
        router.push(`/seo/content/${briefId}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat brief."));
        setActingId(null);
      }
    });
  }

  function handleDismiss(item: OpportunityRow) {
    setActingId(item.id);
    startTransition(async () => {
      try {
        await dismissOpportunity(item.id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengabaikan."));
      } finally {
        setActingId(null);
      }
    });
  }

  function handleRestore(item: OpportunityRow) {
    setActingId(item.id);
    startTransition(async () => {
      try {
        await restoreOpportunity(item.id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengembalikan."));
      } finally {
        setActingId(null);
      }
    });
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "Semua" },
    { key: "new", label: "Artikel baru" },
    { key: "optimize", label: "Optimasi" },
    { key: "dismissed", label: "Diabaikan" },
  ];

  return (
    <SeoModulePage
      icon={Lightbulb}
      title="Content Opportunities"
      description="Rekomendasi artikel dari AI yang membaca riset keyword & posisi ranking Anda — diurutkan dari peluang terbaik."
      right={
        <Button
          size="sm"
          onClick={handleRefresh}
          disabled={pending || refreshing}
        >
          {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Refresh feed
        </Button>
      }
    >
      {/* Ringkasan pipeline */}
      {items.length > 0 ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          <div className="bento-tile border-transparent bg-teal-600 shadow-md shadow-teal-600/20 dark:bg-teal-500">
            <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
              Opportunity aktif
            </span>
            <span className="bento-value text-white dark:text-teal-950">
              {summary.active}
            </span>
            <span className="text-[11px] font-medium text-teal-100/90 dark:text-teal-900/80">
              {summary.newArticles} artikel baru · {summary.optimize} optimasi
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Skor tertinggi</span>
            <span className="bento-value">{summary.bestScore ?? "—"}</span>
            <span className="text-muted-foreground text-[11px] font-medium">
              peluang terbaik di feed
            </span>
          </div>

          {/* Pipeline — strip violet ala dashboard SEO */}
          <div className="bento-tile col-span-2 border-transparent bg-[#e9e3f9] sm:flex-row sm:items-center dark:bg-violet-400/10">
            <span className="text-[11.5px] font-semibold text-violet-700/70 sm:w-20 sm:shrink-0 dark:text-violet-300/70">
              Pipeline
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5 text-violet-950 dark:text-violet-200">
              {summary.pipeline.map(([label, count], index) => (
                <span key={label} className="inline-flex items-center gap-2">
                  <span className="bg-card inline-flex items-baseline gap-1.5 rounded-full px-3 py-1.5 shadow-sm">
                    <span className="text-sm font-extrabold tabular-nums">
                      {count}
                    </span>
                    <span className="text-muted-foreground text-xs font-medium">
                      {label}
                    </span>
                  </span>
                  {index < summary.pipeline.length - 1 ? (
                    <span className="text-violet-400 dark:text-violet-500">
                      →
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <LabEmptyState
          icon={Lightbulb}
          title="Belum ada opportunity"
          description="Jalankan riset keyword atau tambah keyword ke rank tracker, lalu klik “Refresh feed”. Feed juga ter-update otomatis tiap hari setelah rank sync."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {clusters.map(([cluster, rows]) => (
            <div key={cluster} className={lab.entrance}>
              <p className={cn(lab.label, "mb-2")}>{cluster}</p>
              <div className="grid gap-3 lg:grid-cols-2">
                {rows.map((item) => (
                  <div key={item.id} className={cn(lab.card, "flex flex-col p-0")}>
                    <div className="flex flex-1 flex-col gap-4 p-5 pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={cn(
                              "flex size-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold tabular-nums",
                              scoreToneClass(item.opportunityScore),
                            )}
                            title="Opportunity score"
                          >
                            {Math.round(item.opportunityScore)}
                          </span>
                          <div className="min-w-0">
                            <p className="text-foreground truncate font-bold tracking-tight">
                              {item.suggestedTitle ?? item.keyword}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {item.keyword}
                              {item.angle ? ` — ${item.angle}` : ""}
                            </p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center rounded-lg px-2 py-1 text-[11px] font-bold",
                            STAGE_PILL[item.stage],
                          )}
                        >
                          {STAGE_LABELS[item.stage]}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        <CardStat label="Volume" value={num(item.searchVolume)} />
                        <CardStat label="KD" value={item.difficulty ?? "—"} />
                        <CardStat
                          label="Intent"
                          value={
                            <span className="text-xs font-bold">
                              {SEO_INTENT_LABELS[item.intent]}
                            </span>
                          }
                        />
                        <CardStat
                          label="Posisi"
                          value={
                            item.currentPosition != null
                              ? `#${item.currentPosition}`
                              : "—"
                          }
                        />
                      </div>

                      {item.targetUrl ? (
                        <a
                          href={item.targetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-foreground inline-flex max-w-full items-center gap-1 truncate text-xs transition-colors"
                        >
                          <ExternalLink className="size-3 shrink-0" />
                          <span className="truncate">
                            {item.targetUrl.replace(/^https?:\/\//, "")}
                          </span>
                        </a>
                      ) : null}
                    </div>

                    <div className="border-border/60 flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-bold",
                          item.type === "OPTIMIZE_EXISTING"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            : "bg-teal-500/15 text-teal-700 dark:text-teal-300",
                        )}
                      >
                        {item.type === "OPTIMIZE_EXISTING"
                          ? `Optimasi — posisi #${item.currentPosition ?? "?"}`
                          : "Artikel baru"}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.stage === "DISMISSED" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRestore(item)}
                            disabled={pending && actingId === item.id}
                          >
                            <Undo2 />
                            Kembalikan
                          </Button>
                        ) : item.briefId ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              render={
                                <Link href={`/seo/content/${item.briefId}`} />
                              }
                            >
                              <FileText />
                              Buka brief
                            </Button>
                            {item.draftId ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                render={
                                  <Link
                                    href={`/seo/content/draft/${item.draftId}`}
                                  />
                                }
                              >
                                <PenLine />
                                Buka draft
                              </Button>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDismiss(item)}
                              disabled={pending && actingId === item.id}
                            >
                              <X />
                              Abaikan
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleCreateBrief(item)}
                              disabled={pending && actingId === item.id}
                            >
                              {pending && actingId === item.id ? (
                                <Loader2 className="animate-spin" />
                              ) : (
                                <Sparkles />
                              )}
                              Buat brief
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </SeoModulePage>
  );
}
