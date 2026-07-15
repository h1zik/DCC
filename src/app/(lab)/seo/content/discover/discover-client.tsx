"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus, SeoKeywordIntent } from "@prisma/client";
import { Lightbulb, Loader2, PenLine, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LabEmptyState,
  LabSection,
  lab,
} from "@/components/lab/lab-primitives";
import {
  SEO_INTENT_LABELS,
  SEO_STATUS_LABELS,
  isSeoStatusBusy,
  scoreToneClass,
} from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createTopicDiscovery,
  deleteTopicDiscovery,
} from "@/actions/seo-content-discovery";
import { createContentBrief } from "@/actions/seo-content";
import { saveTopicSuggestionToFeed } from "@/actions/seo-content-opportunities";
import { cn } from "@/lib/utils";

type Suggestion = {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  intent: SeoKeywordIntent;
  opportunityScore: number;
  suggestedTitle: string;
  angle: string | null;
  competingTitles: string[];
};

export type DiscoveryRun = {
  id: string;
  seed: string;
  status: SeoAnalysisStatus;
  suggestions: Suggestion[];
  dataNotice: string | null;
  errorMessage: string | null;
  createdAt: string;
};

function num(v: number | null): string {
  return v == null ? "—" : v.toLocaleString("id-ID");
}

/** Pill status run (emerald siap, amber berdenyut saat proses, rose gagal). */
function StatusPill({ status }: { status: SeoAnalysisStatus }) {
  const tone =
    status === SeoAnalysisStatus.READY
      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
      : status === SeoAnalysisStatus.FAILED
        ? "bg-rose-500/12 text-rose-700 dark:text-rose-300"
        : "bg-amber-500/12 text-amber-700 dark:text-amber-300";
  const dot =
    status === SeoAnalysisStatus.READY
      ? "bg-emerald-500"
      : status === SeoAnalysisStatus.FAILED
        ? "bg-rose-500"
        : "bg-amber-500 animate-pulse";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot)} />
      {SEO_STATUS_LABELS[status]}
    </span>
  );
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

export function TopicDiscoveryClient({ runs }: { runs: DiscoveryRun[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [seed, setSeed] = useState("");
  const [creatingKw, setCreatingKw] = useState<string | null>(null);

  const hasBusy = runs.some((r) => isSeoStatusBusy(r.status));
  useEffect(() => {
    if (!hasBusy) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [hasBusy, router]);

  /* ------------------------------ Ringkasan strip ------------------------------ */
  const summary = useMemo(() => {
    const all = runs.flatMap((r) => r.suggestions);
    const best = all.length
      ? all.reduce((a, b) => (b.opportunityScore > a.opportunityScore ? b : a))
      : null;
    const avgScore = all.length
      ? Math.round(
          all.reduce((acc, s) => acc + s.opportunityScore, 0) / all.length,
        )
      : null;
    return {
      totalSuggestions: all.length,
      totalRuns: runs.length,
      busyRuns: runs.filter((r) => isSeoStatusBusy(r.status)).length,
      best,
      avgScore,
    };
  }, [runs]);

  function handleDiscover() {
    if (!seed.trim()) {
      toast.error("Seed/kategori wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await createTopicDiscovery({ seed: seed.trim() });
        setSeed("");
        toast.success("Mencari topik — berjalan di background.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memulai discovery."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteTopicDiscovery(id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  function handleSaveToFeed(s: Suggestion, runId: string) {
    startTransition(async () => {
      try {
        await saveTopicSuggestionToFeed({
          keyword: s.keyword,
          suggestedTitle: s.suggestedTitle,
          angle: s.angle ?? undefined,
          searchVolume: s.searchVolume,
          difficulty: s.difficulty,
          intent: s.intent,
          opportunityScore: s.opportunityScore,
          sourceRefId: runId,
        });
        toast.success("Disimpan ke feed Opportunities.");
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan."));
      }
    });
  }

  function handleCreateBrief(s: Suggestion) {
    setCreatingKw(s.keyword);
    startTransition(async () => {
      try {
        const { id } = await createContentBrief({
          targetKeyword: s.keyword,
          title: s.suggestedTitle,
        });
        toast.success("Brief dibuat — menyusun outline.");
        router.push(`/seo/content/${id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat brief."));
        setCreatingKw(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Ringkasan discovery */}
      {runs.length > 0 ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          <div className="bento-tile border-transparent bg-teal-600 shadow-md shadow-teal-600/20 dark:bg-teal-500">
            <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
              Topik diusulkan
            </span>
            <span className="bento-value text-white dark:text-teal-950">
              {summary.totalSuggestions}
            </span>
            <span className="text-[11px] font-medium text-teal-100/90 dark:text-teal-900/80">
              dari {summary.totalRuns} discovery
              {summary.busyRuns > 0 ? ` · ${summary.busyRuns} diproses` : ""}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Skor opportunity rata-rata</span>
            <span className="bento-value">{summary.avgScore ?? "—"}</span>
            <span className="text-muted-foreground text-[11px] font-medium">
              winnable + worth it, 0–100
            </span>
          </div>

          <div className="bento-tile col-span-2">
            <span className="bento-label">Peluang terbaik</span>
            {summary.best ? (
              <>
                <span className="truncate text-lg font-extrabold tracking-tight">
                  “{summary.best.keyword}”
                </span>
                <span className="text-muted-foreground truncate text-[11px] font-medium">
                  skor {summary.best.opportunityScore} · vol{" "}
                  {num(summary.best.searchVolume)} ·{" "}
                  {SEO_INTENT_LABELS[summary.best.intent]}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground text-sm">
                Menunggu hasil discovery pertama…
              </span>
            )}
          </div>
        </div>
      ) : null}

      <LabSection
        title="Temukan topik dari data"
        description="Cukup masukkan kategori/seed. Kami tarik keyword + metrik nyata, skor opportunity, dan usulkan judul yang grounding ke SERP."
      >
        <div
          className={cn(
            lab.panel,
            "grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end",
          )}
        >
          <div className="grid gap-1.5">
            <Label>Seed / kategori</Label>
            <Input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="mis. parfum gen-z, serum vitamin c, sunscreen"
              disabled={pending}
            />
          </div>
          <Button onClick={handleDiscover} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Temukan topik
          </Button>
        </div>
      </LabSection>

      {runs.length === 0 ? (
        <LabEmptyState
          icon={Sparkles}
          title="Belum ada discovery"
          description="Masukkan satu kategori di atas untuk melihat keyword + judul ter-ranking."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {runs.map((run) => (
            <div key={run.id} className={cn(lab.card, lab.entrance, "p-0")}>
              {/* Header run */}
              <div className="border-border/60 flex items-center justify-between gap-2 border-b px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="bg-primary/12 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg"
                    aria-hidden
                  >
                    <Sparkles className="size-4" />
                  </span>
                  <p className="text-foreground truncate font-bold tracking-tight">
                    “{run.seed}”
                  </p>
                  <StatusPill status={run.status} />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {run.suggestions.length > 0 ? (
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {run.suggestions.length} topik
                    </span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(run.id)}
                    disabled={pending}
                    aria-label="Hapus"
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2 p-4">
                {run.status === SeoAnalysisStatus.FAILED && run.errorMessage ? (
                  <p className="text-destructive text-sm">{run.errorMessage}</p>
                ) : null}
                {run.dataNotice ? (
                  <p className="text-muted-foreground text-sm">
                    {run.dataNotice}
                  </p>
                ) : null}

                {isSeoStatusBusy(run.status) ? (
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Loader2 className="size-4 animate-spin" />
                    Menarik keyword, skor opportunity, & grounding SERP…
                  </p>
                ) : run.suggestions.length === 0 && !run.dataNotice ? (
                  <p className="text-muted-foreground text-sm">
                    Tidak ada saran.
                  </p>
                ) : (
                  run.suggestions.map((s) => (
                    <div
                      key={s.keyword}
                      className={cn(
                        lab.nestedPanel,
                        "flex flex-col gap-3 lg:flex-row lg:items-center",
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div
                          className={cn(
                            "flex size-11 shrink-0 flex-col items-center justify-center rounded-xl border text-base font-bold tabular-nums",
                            scoreToneClass(s.opportunityScore),
                          )}
                          title="Opportunity score"
                        >
                          {s.opportunityScore}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground font-bold tracking-tight">
                            {s.suggestedTitle}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            <span className="text-foreground font-medium">
                              {s.keyword}
                            </span>
                            {s.angle ? (
                              <span className="italic"> — {s.angle}</span>
                            ) : null}
                          </p>
                          {s.competingTitles.length > 0 ? (
                            <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
                              Saingan:{" "}
                              {s.competingTitles.slice(0, 2).join(" · ")}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid shrink-0 grid-cols-3 gap-x-4 gap-y-2 lg:w-56">
                        <CardStat label="Volume" value={num(s.searchVolume)} />
                        <CardStat
                          label="Difficulty"
                          value={s.difficulty ?? "—"}
                        />
                        <CardStat
                          label="Intent"
                          value={
                            <span className="text-xs font-bold">
                              {SEO_INTENT_LABELS[s.intent]}
                            </span>
                          }
                        />
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSaveToFeed(s, run.id)}
                          disabled={pending}
                          title="Simpan ke feed Opportunities"
                        >
                          <Lightbulb />
                          Ke feed
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleCreateBrief(s)}
                          disabled={pending}
                        >
                          {creatingKw === s.keyword ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <PenLine />
                          )}
                          Buat brief
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
