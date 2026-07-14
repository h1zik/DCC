"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import {
  ArrowLeft,
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
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import {
  LabEmptyState,
  lab,
} from "@/components/lab/lab-primitives";
import { isSeoStatusBusy, scoreToneClass } from "@/lib/seo/labels";
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

export function ContentBriefClient({ brief }: { brief: BriefDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const busy = isSeoStatusBusy(brief.status);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => router.refresh(), 4000);
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

  return (
    <SeoDetailPage
      icon={FileText}
      title={brief.title}
      description={`Keyword target: "${brief.targetKeyword}"`}
      right={
        <div className="flex items-center gap-2">
          <SeoStatusBadge status={brief.status} />
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
          <Button variant="ghost" size="sm" render={<Link href="/seo/content" />}>
            <ArrowLeft />
            Kembali
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
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="flex flex-col gap-5">
            {brief.angle ? (
              <div className={lab.panel}>
                <p className={cn(lab.label, "mb-2")}>Angle</p>
                <p className="text-sm leading-relaxed">{brief.angle}</p>
              </div>
            ) : null}

            <div className={cn(lab.card, "p-4")}>
              <p className="mb-3 font-semibold">Outline</p>
              {brief.outline.length === 0 ? (
                <p className="text-muted-foreground text-sm">Belum ada outline.</p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {brief.outline.map((section, i) => (
                    <li key={i}>
                      <p className="font-medium">
                        {i + 1}. {section.heading}
                      </p>
                      {section.points.length > 0 ? (
                        <ul className="text-muted-foreground ml-5 mt-1 list-disc text-sm">
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
              <div className={cn(lab.card, "p-4")}>
                <p className="mb-3 font-semibold">
                  Yang sedang ranking (Google ID)
                </p>
                <div className="flex flex-col gap-1.5">
                  {brief.serpData.map((r) => (
                    <a
                      key={r.rank}
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        lab.nestedPanel,
                        "flex items-center gap-3 hover:border-primary/40",
                      )}
                    >
                      <span className="text-muted-foreground w-6 shrink-0 text-center text-xs font-bold tabular-nums">
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
              <div className={cn(lab.card, "p-4")}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold">Halaman kompetitor terbaca</p>
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

            <div className={cn(lab.card, "p-4")}>
              <p className="mb-2 font-semibold">Draft dari brief ini</p>
              {brief.drafts.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Belum ada draft. Klik “Tulis draft” untuk menghasilkan artikel.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {brief.drafts.map((d) => (
                    <Link
                      key={d.id}
                      href={`/seo/content/draft/${d.id}`}
                      className={cn(
                        lab.nestedPanel,
                        "flex items-center gap-3 hover:border-primary/40",
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

          <div className="flex h-fit flex-col gap-5">
            {brief.terms.length > 0 ? (
              <div className={cn(lab.card, "p-4")}>
                <p className="mb-1 font-semibold">Istilah penting</p>
                <p className="text-muted-foreground mb-3 text-xs">
                  Dipakai kompetitor yang ranking — gunakan secara natural.
                </p>
                <div className="flex flex-col gap-1">
                  {brief.terms.slice(0, 20).map((t) => (
                    <div
                      key={t.term}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 truncate">{t.term}</span>
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
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
              <div className={cn(lab.card, "p-4")}>
                <p className="mb-1 font-semibold">Pertanyaan pencari</p>
                <p className="text-muted-foreground mb-3 text-xs">
                  People Also Ask — jawab di artikel/FAQ.
                </p>
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

            <div className={cn(lab.card, "p-4")}>
              <p className="mb-2 font-semibold">Related keywords</p>
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
      )}
    </SeoDetailPage>
  );
}
