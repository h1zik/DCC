"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Lightbulb, RefreshCw, TriangleAlert } from "lucide-react";
import { ProductInnovationStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  promoteIdeaToConcept,
  regenerateProductInnovation,
} from "@/actions/research-product-innovation";
import { actionErrorMessage } from "@/lib/action-error-message";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { ResearchHubDetailPage } from "@/components/research-hub/research-hub-module-page";
import { ScamperIdeaCard } from "@/components/research-hub/scamper-idea-card";
import { Button } from "@/components/ui/button";
import { lab, LabEmptyState, LabSection } from "@/components/lab/lab-primitives";
import {
  SCAMPER_TECHNIQUES,
  type ScamperIdea,
} from "@/lib/research/product-innovation/types";
import type { RiskFactor } from "@/lib/research/concept-lab/types";
import { cn } from "@/lib/utils";

export type InnovationDetailData = {
  id: string;
  title: string;
  baseProduct: string;
  category: string;
  targetMarket: string | null;
  status: ProductInnovationStatus;
  ideas: ScamperIdea[];
  riskFactors: RiskFactor[];
  aiSummary: string | null;
  errorMessage: string | null;
  aiMeta: unknown;
};

/** Warna segmen distribusi per lensa SCAMPER (urutan = SCAMPER_TECHNIQUES). */
const TECHNIQUE_DOTS = [
  "bg-violet-500",
  "bg-teal-500",
  "bg-amber-400",
  "bg-rose-400",
  "bg-emerald-500",
  "bg-slate-400 dark:bg-slate-500",
] as const;

const SEVERITY_PILL: Record<RiskFactor["severity"], string> = {
  HIGH: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  MED: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  LOW: "bg-muted text-muted-foreground",
};

export function InnovationDetailClient({
  data,
}: {
  data: InnovationDetailData;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const isGenerating = data.status === "GENERATING";
  const promotedCount = data.ideas.filter((i) => i.promotedConceptId).length;

  const techniqueCounts = useMemo(
    () =>
      SCAMPER_TECHNIQUES.map((tech, index) => ({
        key: tech.key,
        label: tech.labelId,
        dot: TECHNIQUE_DOTS[index % TECHNIQUE_DOTS.length],
        count: data.ideas.filter((i) => i.technique === tech.key).length,
      })),
    [data.ideas],
  );
  const ideaTotal = data.ideas.length || 1;

  useEffect(() => {
    if (!isGenerating) return;
    const id = window.setInterval(() => router.refresh(), 10_000);
    return () => window.clearInterval(id);
  }, [isGenerating, router]);

  function handleRegenerate() {
    startTransition(async () => {
      try {
        await regenerateProductInnovation(data.id);
        toast.success("Regenerate dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal regenerate."));
      }
    });
  }

  function handlePromote(idea: ScamperIdea) {
    setPromotingId(idea.id);
    startTransition(async () => {
      try {
        const res = await promoteIdeaToConcept(data.id, idea.id);
        toast.success(
          res.alreadyPromoted
            ? "Ide sudah dipromosikan sebelumnya."
            : "Ide dipromosikan ke Concept Lab.",
        );
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal promote."));
      } finally {
        setPromotingId(null);
      }
    });
  }

  return (
    <ResearchHubDetailPage
      icon={Lightbulb}
      backHref="/research-hub/product-innovation"
      title={data.baseProduct}
      description={`${data.category}${data.targetMarket ? ` · ${data.targetMarket}` : ""} · 6 lensa SCAMPER`}
      right={
        <Button
          size="sm"
          variant="outline"
          onClick={handleRegenerate}
          disabled={pending || isGenerating}
        >
          <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
          Regenerate
        </Button>
      }
    >
      {data.status === "FAILED" ? (
        <p
          className={cn(
            lab.entrance,
            "flex items-start gap-2.5 rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-200",
          )}
          role="alert"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {data.errorMessage ?? "Generasi gagal. Coba regenerate."}
        </p>
      ) : null}

      {isGenerating ? (
        <div className={lab.entrance}>
          <JobProgressBar
            title="AI sedang menerapkan SCAMPER"
            percent={60}
            stepLabel="Membaca evidence riset lalu menyusun alternatif per lensa — halaman refresh otomatis."
          />
        </div>
      ) : null}

      {/* Papan hero bento */}
      {data.ideas.length > 0 ? (
        <div
          className={cn(
            lab.entrance,
            "grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4",
          )}
        >
          <div className="bento-tile row-span-2 border-transparent bg-violet-600 shadow-md shadow-violet-600/20 dark:bg-violet-500">
            <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
              Ide dihasilkan
            </span>
            <span className="bento-value text-5xl text-white dark:text-violet-950">
              {data.ideas.length}
            </span>
            <span className="text-xs font-medium leading-snug text-violet-100/90 dark:text-violet-900/80">
              alternatif inovasi dari 6 lensa SCAMPER
            </span>
          </div>

          {/* Distribusi lensa — tile lebar */}
          <div className="bento-tile col-span-2 row-span-2 justify-start gap-3">
            <div className="flex items-center justify-between">
              <span className="bento-label">Distribusi lensa</span>
              <span className="text-muted-foreground text-[11px] tabular-nums">
                {data.ideas.length} ide
              </span>
            </div>
            <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
              {techniqueCounts.map((t) =>
                t.count === 0 ? null : (
                  <div
                    key={t.key}
                    className={t.dot}
                    style={{ width: `${(t.count / ideaTotal) * 100}%` }}
                    title={`${t.label}: ${t.count}`}
                  />
                ),
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {techniqueCounts.map((t) => (
                <div key={t.key} className="flex items-center gap-2 text-xs">
                  <span
                    className={cn("size-2 shrink-0 rounded-full", t.dot)}
                    aria-hidden
                  />
                  <span className="text-muted-foreground min-w-0 flex-1 truncate">
                    {t.label}
                  </span>
                  <span className="font-semibold tabular-nums">{t.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Dipromosikan</span>
            <span
              className={cn(
                "bento-value",
                promotedCount > 0 && "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {promotedCount}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              jadi konsep di Concept Lab
            </span>
          </div>

          <div
            className={cn(
              "bento-tile",
              data.riskFactors.length > 0
                ? "border-transparent bg-[#fbdcd7] dark:bg-rose-400/10"
                : undefined,
            )}
          >
            <span
              className={cn(
                data.riskFactors.length > 0
                  ? "text-[11.5px] font-semibold text-rose-800/70 dark:text-rose-200/60"
                  : "bento-label",
              )}
            >
              Risiko pasar
            </span>
            <span
              className={cn(
                "bento-value",
                data.riskFactors.length > 0 &&
                  "text-rose-900 dark:text-rose-300",
              )}
            >
              {data.riskFactors.length}
            </span>
            <span
              className={cn(
                "text-[11px] font-medium",
                data.riskFactors.length > 0
                  ? "text-rose-800/70 dark:text-rose-200/60"
                  : "text-muted-foreground",
              )}
            >
              dasar inovasi dari riset
            </span>
          </div>
        </div>
      ) : null}

      {data.aiSummary ? (
        <div className={cn(lab.entrance, "bento-tile justify-start gap-3")}>
          <span className="bento-label">Ringkasan evidence</span>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {data.aiSummary}
          </p>
        </div>
      ) : null}

      {data.riskFactors.length > 0 ? (
        <div className={cn(lab.entrance, "bento-tile justify-start gap-3")}>
          <span className="bento-label">
            Faktor risiko pasar (dasar inovasi)
          </span>
          <div className="flex flex-wrap gap-2">
            {data.riskFactors.map((r, i) => (
              <span
                key={i}
                className="bg-muted/60 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
              >
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    SEVERITY_PILL[r.severity],
                  )}
                >
                  {r.severity}
                </span>
                {r.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {data.ideas.length === 0 ? (
        !isGenerating ? (
          <LabEmptyState
            icon={Lightbulb}
            title="Belum ada ide"
            description="Belum ada alternatif SCAMPER. Coba regenerate."
            action={
              <Button
                size="sm"
                onClick={handleRegenerate}
                disabled={pending}
              >
                <RefreshCw className="size-3.5" aria-hidden />
                Regenerate
              </Button>
            }
          />
        ) : null
      ) : (
        SCAMPER_TECHNIQUES.map((tech, index) => {
          const ideas = data.ideas.filter((i) => i.technique === tech.key);
          if (ideas.length === 0) return null;
          return (
            <LabSection
              key={tech.key}
              title={`${tech.label} · ${tech.labelId}`}
              description={tech.hint}
              action={
                <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      TECHNIQUE_DOTS[index % TECHNIQUE_DOTS.length],
                    )}
                    aria-hidden
                  />
                  {ideas.length} ide
                </span>
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {ideas.map((idea) => (
                  <ScamperIdeaCard
                    key={idea.id}
                    idea={idea}
                    promoting={pending && promotingId === idea.id}
                    onPromote={() => handlePromote(idea)}
                  />
                ))}
              </div>
            </LabSection>
          );
        })
      )}
    </ResearchHubDetailPage>
  );
}
