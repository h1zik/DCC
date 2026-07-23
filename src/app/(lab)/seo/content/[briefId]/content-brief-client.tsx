"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import {
  ExternalLink,
  FileText,
  Globe,
  HelpCircle,
  Loader2,
  PenLine,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SeoDetailPage } from "@/components/seo/seo-module-page";
import { LabEmptyState, lab } from "@/components/lab/lab-primitives";
import {
  SEO_STATUS_LABELS,
  isSeoStatusBusy,
  scoreToneClass,
} from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  generateDraftFromBriefAction,
  retryContentBrief,
} from "@/actions/seo-content";
import { cn } from "@/lib/utils";

export type BriefDetail = {
  id: string;
  title: string;
  targetKeyword: string;
  status: SeoAnalysisStatus;
  angle: string | null;
  relatedKeywords: string[];
  outline: { heading: string; points: string[] }[];
  errorMessage: string | null;
  dataNotice: string | null;
  stepLabel: string | null;
  percent: number;
  serpData: { rank: number; title: string; url: string; domain: string }[];
  paaQuestions: string[];
  relatedSearches: string[];
  competitors: {
    url: string;
    domain: string;
    fetchStatus: "ok" | "blocked" | "failed" | "skipped";
    title: string | null;
    wordCount: number;
    headings: { level: number; text: string }[];
  }[];
  terms: {
    term: string;
    docCount: number;
    avgCount: number;
    targetMin: number;
    targetMax: number;
  }[];
  targetWordCount: number | null;
  targetHeadings: number | null;
  drafts: { id: string; title: string; score: number | null }[];
};

/** Pill status brief (emerald siap, amber berdenyut saat proses, rose gagal). */
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
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
        tone,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot)} />
      {SEO_STATUS_LABELS[status]}
    </span>
  );
}

export function ContentBriefClient({ brief }: { brief: BriefDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const busy = isSeoStatusBusy(brief.status);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 4000);
    return () => clearInterval(timer);
  }, [busy, router]);

  function handleGenerateDraft() {
    setGenerating(true);
    startTransition(async () => {
      try {
        const { draftId } = await generateDraftFromBriefAction(brief.id);
        toast.success("Penulisan draft dimulai.");
        router.push(`/seo/content/draft/${draftId}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menulis draft."));
        setGenerating(false);
      }
    });
  }

  function handleRetry() {
    setRetrying(true);
    startTransition(async () => {
      try {
        await retryContentBrief(brief.id);
        toast.success("Brief diproses ulang.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memproses ulang."));
      } finally {
        setRetrying(false);
      }
    });
  }

  const okCompetitors = brief.competitors.filter((c) => c.fetchStatus === "ok");
  const grounded = okCompetitors.length > 0 || brief.serpData.length > 0;
  const bestDraftScore = brief.drafts.reduce<number | null>(
    (acc, d) => (d.score != null && (acc == null || d.score > acc) ? d.score : acc),
    null,
  );

  return (
    <SeoDetailPage
      icon={FileText}
      backHref="/seo/content"
      title={brief.title}
      description={`Keyword target: "${brief.targetKeyword}"`}
      right={
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={brief.status} />
          {!busy ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={pending || retrying}
            >
              {retrying ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Riset ulang
            </Button>
          ) : null}
          <Button
            onClick={handleGenerateDraft}
            disabled={pending || generating || busy}
            size="sm"
          >
            {generating ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Tulis draft
          </Button>
        </div>
      }
    >
      {brief.status === SeoAnalysisStatus.FAILED && brief.errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {brief.errorMessage}
        </div>
      ) : null}

      {brief.dataNotice ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400">
          {brief.dataNotice}
        </div>
      ) : null}

      {busy ? (
        <div className={cn(lab.card, "flex flex-col items-center gap-4 p-10")}>
          <Loader2 className="text-primary size-8 animate-spin" />
          <div className="text-center">
            <p className="font-medium">{brief.stepLabel ?? "Menyusun brief…"}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Membaca SERP & halaman kompetitor, lalu menyusun outline. Halaman
              ter-update otomatis.
            </p>
          </div>
          <Progress value={brief.percent} className="max-w-sm" />
        </div>
      ) : (
        <>
          {/* Papan bento brief */}
          <div className="grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4">
            {/* Target kata — tile hero teal */}
            <div className="bento-tile row-span-2 border-transparent bg-teal-600 shadow-md shadow-teal-600/20 dark:bg-teal-500">
              <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
                Target panjang artikel
              </span>
              <span className="bento-value text-5xl text-white dark:text-teal-950">
                {brief.targetWordCount != null
                  ? brief.targetWordCount.toLocaleString("id-ID")
                  : "—"}
                {brief.targetWordCount != null ? (
                  <span className="text-2xl font-bold text-teal-200/80 dark:text-teal-900/60">
                    {" "}
                    kata
                  </span>
                ) : null}
              </span>
              <span className="text-[11px] font-medium leading-snug text-teal-100/90 dark:text-teal-900/80">
                {brief.targetHeadings != null
                  ? `± ${brief.targetHeadings} subjudul · `
                  : ""}
                dari kompetitor yang sedang ranking
              </span>
            </div>

            <div className="bento-tile">
              <span className="bento-label">Hasil SERP dibaca</span>
              <span className="bento-value">{brief.serpData.length}</span>
              <span className="text-muted-foreground text-[11px] font-medium">
                top Google.co.id
              </span>
            </div>

            <div className="bento-tile">
              <span className="bento-label">Kompetitor terbaca</span>
              <span className="bento-value">
                {okCompetitors.length}
                {brief.competitors.length > 0 ? (
                  <span className="text-muted-foreground/60 text-lg font-bold">
                    {" "}
                    / {brief.competitors.length}
                  </span>
                ) : null}
              </span>
              <span className="text-muted-foreground text-[11px] font-medium">
                konten penuh ter-crawl
              </span>
            </div>

            <div className="bento-tile">
              <span className="bento-label">Istilah penting</span>
              <span className="bento-value">{brief.terms.length}</span>
              <span className="text-muted-foreground text-[11px] font-medium">
                dipakai kompetitor
              </span>
            </div>

            {/* Pertanyaan pencari — amber pastel */}
            <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
              <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
                Pertanyaan pencari
              </span>
              <span className="bento-value text-amber-900 dark:text-amber-300">
                {brief.paaQuestions.length}
              </span>
              <span className="text-[11px] font-medium text-amber-800/60 dark:text-amber-200/50">
                People Also Ask
              </span>
            </div>

            <div className="bento-tile">
              <span className="bento-label">Related keywords</span>
              <span className="bento-value">{brief.relatedKeywords.length}</span>
              <span className="text-muted-foreground text-[11px] font-medium">
                untuk disebar natural
              </span>
            </div>

            {/* Draft — violet pastel */}
            <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
              <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
                Draft dihasilkan
              </span>
              <span className="bento-value text-violet-950 dark:text-violet-200">
                {brief.drafts.length}
                {bestDraftScore != null ? (
                  <span className="text-lg font-bold text-violet-700/50 dark:text-violet-300/50">
                    {" "}
                    · skor {bestDraftScore}
                  </span>
                ) : null}
              </span>
              <span className="text-[11px] font-medium text-violet-700/70 dark:text-violet-300/70">
                dari brief ini
              </span>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
            <div className="flex flex-col gap-3">
              {brief.angle ? (
                <div className="bento-tile justify-start gap-3">
                  <span className="bento-label">Angle</span>
                  <p className="text-sm leading-relaxed">{brief.angle}</p>
                </div>
              ) : null}

              <div className="bento-tile justify-start gap-3">
                <div className="flex items-center justify-between">
                  <span className="bento-label">Outline</span>
                  {brief.outline.length > 0 ? (
                    <span className="text-muted-foreground text-[11px] tabular-nums">
                      {brief.outline.length} bagian
                    </span>
                  ) : null}
                </div>
                {brief.outline.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Belum ada outline.
                  </p>
                ) : (
                  <ol className="flex flex-col gap-3">
                    {brief.outline.map((section, i) => (
                      <li key={i}>
                        <p className="flex items-baseline gap-2 font-medium">
                          <span className="bg-primary/12 text-primary inline-flex size-5 shrink-0 translate-y-0.5 items-center justify-center rounded-md text-[11px] font-bold tabular-nums">
                            {i + 1}
                          </span>
                          {section.heading}
                        </p>
                        {section.points.length > 0 ? (
                          <ul className="text-muted-foreground ml-7 mt-1 list-disc text-sm">
                            {section.points.map((p, j) => (
                              <li key={j}>{p}</li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {brief.serpData.length > 0 ? (
                <div className="bento-tile justify-start gap-3">
                  <div className="flex items-center justify-between">
                    <span className="bento-label">
                      Yang sedang ranking (Google ID)
                    </span>
                    <span className="text-muted-foreground text-[11px] tabular-nums">
                      {brief.serpData.length} hasil
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {brief.serpData.map((r) => (
                      <a
                        key={r.rank}
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          lab.nestedPanel,
                          "flex items-center gap-3 transition-colors hover:border-primary/40",
                        )}
                      >
                        <span className="bg-teal-500/15 inline-flex min-w-9 shrink-0 items-center justify-center rounded-lg px-2 py-1 text-xs font-bold tabular-nums text-teal-700 dark:text-teal-300">
                          #{r.rank}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {r.title}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {r.domain}
                          </span>
                        </span>
                        <ExternalLink className="text-muted-foreground size-3.5 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              {okCompetitors.length > 0 ? (
                <div className="bento-tile justify-start gap-3">
                  <div className="flex items-center justify-between">
                    <span className="bento-label">
                      Halaman kompetitor terbaca
                    </span>
                    {brief.targetWordCount ? (
                      <Badge variant="secondary">
                        Target: ~{brief.targetWordCount} kata
                        {brief.targetHeadings
                          ? ` · ${brief.targetHeadings} subjudul`
                          : ""}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {okCompetitors.map((c) => (
                      <div key={c.url} className={cn(lab.nestedPanel, "text-sm")}>
                        <div className="flex items-center gap-2">
                          <Globe className="text-muted-foreground size-3.5 shrink-0" />
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {c.title ?? c.domain}
                          </span>
                          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                            {c.wordCount} kata · {c.headings.length} heading
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="bento-tile justify-start gap-3">
                <span className="bento-label">Draft dari brief ini</span>
                {brief.drafts.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Belum ada draft. Klik “Tulis draft” untuk menghasilkan
                    artikel.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {brief.drafts.map((d) => (
                      <Link
                        key={d.id}
                        href={`/seo/content/draft/${d.id}`}
                        className={cn(
                          lab.nestedPanel,
                          "flex items-center gap-3 transition-colors hover:border-primary/40",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-8 items-center justify-center rounded-lg border text-xs font-bold tabular-nums",
                            scoreToneClass(d.score),
                          )}
                        >
                          {d.score ?? "—"}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {d.title}
                        </span>
                        <PenLine className="text-muted-foreground size-4" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex h-fit flex-col gap-3">
              {brief.terms.length > 0 ? (
                <div className="bento-tile justify-start gap-3">
                  <div>
                    <span className="bento-label">Istilah penting</span>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Dipakai kompetitor yang ranking — gunakan secara natural.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {brief.terms.slice(0, 20).map((t) => (
                      <div
                        key={t.term}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="min-w-0 truncate">{t.term}</span>
                        <span className="bg-muted/70 text-foreground/80 shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
                          {t.targetMin === t.targetMax
                            ? `${t.targetMin}×`
                            : `${t.targetMin}–${t.targetMax}×`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {brief.paaQuestions.length > 0 ? (
                <div className="bento-tile justify-start gap-3">
                  <div>
                    <span className="bento-label">Pertanyaan pencari</span>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      People Also Ask — jawab di artikel/FAQ.
                    </p>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {brief.paaQuestions.slice(0, 8).map((q) => (
                      <li key={q} className="flex items-start gap-2 text-sm">
                        <HelpCircle className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="bento-tile justify-start gap-3">
                <span className="bento-label">Related keywords</span>
                {brief.relatedKeywords.length === 0 ? (
                  <p className="text-muted-foreground text-sm">—</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {brief.relatedKeywords.map((k) => (
                      <Badge key={k} variant="outline">
                        {k}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {!grounded ? (
                <LabEmptyState
                  icon={Globe}
                  title="Belum ter-grounding"
                  description="Brief ini dibuat tanpa data SERP. Klik “Riset ulang” untuk grounding dengan data kompetitor nyata."
                />
              ) : null}
            </div>
          </div>
        </>
      )}
    </SeoDetailPage>
  );
}
