"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Lightbulb, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { ProductInnovationStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  promoteIdeaToConcept,
  regenerateProductInnovation,
} from "@/actions/research-product-innovation";
import { actionErrorMessage } from "@/lib/action-error-message";
import { ResearchHubDetailPage } from "@/components/research-hub/research-hub-module-page";
import { ScamperIdeaCard } from "@/components/research-hub/scamper-idea-card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RunStatusBadge, type RunTone } from "@/components/research-hub/kit/run-status";
import { ResearchPanelEmpty } from "@/components/research-hub/kit/research-states";
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

const STATUS_LABELS: Record<ProductInnovationStatus, string> = {
  DRAFT: "Draft",
  GENERATING: "Menyusun ide",
  READY: "Siap",
  FAILED: "Gagal",
};

function toneOf(status: ProductInnovationStatus): RunTone {
  if (status === "READY") return "ready";
  if (status === "FAILED") return "failed";
  if (status === "GENERATING") return "running";
  return "idle";
}

const SEVERITY_META: Record<RiskFactor["severity"], { label: string; className: string }> = {
  HIGH: { label: "Tinggi", className: "text-rose-700 dark:text-rose-300" },
  MED: { label: "Sedang", className: "text-amber-700 dark:text-amber-300" },
  LOW: { label: "Rendah", className: "text-muted-foreground" },
};

function Section({
  title,
  aside,
  meta,
  count,
  children,
}: {
  title: string;
  aside?: string;
  meta?: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="rh-section-title">
            {title}
            {aside ? (
              <span className="text-muted-foreground ms-2 text-sm font-normal">{aside}</span>
            ) : null}
          </h2>
          {meta ? <p className="rh-meta">{meta}</p> : null}
        </div>
        {count != null ? <span className="rh-meta rh-num">{count} ide</span> : null}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="rh-meta">{label}</dt>
      <dd className="rh-num text-foreground mt-0.5 text-lg font-semibold">{children}</dd>
    </div>
  );
}

export function InnovationDetailClient({ data }: { data: InnovationDetailData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [regenOpen, setRegenOpen] = useState(false);

  const tone = toneOf(data.status);
  const isGenerating = data.status === "GENERATING";
  const promotedCount = data.ideas.filter((i) => i.promotedConceptId).length;

  const techniqueCounts = useMemo(
    () =>
      SCAMPER_TECHNIQUES.map((tech) => ({
        key: tech.key,
        label: tech.labelId,
        count: data.ideas.filter((i) => i.technique === tech.key).length,
      })),
    [data.ideas],
  );

  useEffect(() => {
    if (!isGenerating) return;
    const id = window.setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 10_000);
    return () => window.clearInterval(id);
  }, [isGenerating, router]);

  function handleRegenerate() {
    startTransition(async () => {
      try {
        await regenerateProductInnovation(data.id);
        toast.success("Ide sedang disusun ulang.");
        setRegenOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Penyusunan ulang gagal dimulai."));
      }
    });
  }

  function requestRegenerate() {
    if (data.ideas.length > 0) setRegenOpen(true);
    else handleRegenerate();
  }

  function handlePromote(idea: ScamperIdea) {
    setPromotingId(idea.id);
    startTransition(async () => {
      try {
        const res = await promoteIdeaToConcept(data.id, idea.id);
        toast.success(
          res.alreadyPromoted
            ? "Ide ini sudah jadi konsep sebelumnya."
            : "Ide dijadikan konsep di Concept Lab.",
        );
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Ide gagal dijadikan konsep."));
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
      meta={
        <>
          <RunStatusBadge tone={tone} label={STATUS_LABELS[data.status]} />
          <span>Kategori: {data.category}</span>
          {data.targetMarket ? <span>Target: {data.targetMarket}</span> : null}
        </>
      }
      right={
        <Button size="sm" variant="outline" onClick={requestRegenerate} disabled={pending || isGenerating}>
          <RefreshCw className={cn(pending && !promotingId && "motion-safe:animate-spin")} aria-hidden />
          Susun ulang ide
        </Button>
      }
    >
      {data.status === "FAILED" ? (
        <div
          className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-800 dark:text-rose-200"
          role="alert"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Ide gagal disusun</p>
            <p className="mt-0.5">{data.errorMessage ?? "AI tidak mengembalikan hasil."}</p>
            <p className="mt-1 text-xs">Klik Susun ulang ide untuk mencoba lagi.</p>
          </div>
        </div>
      ) : null}

      {isGenerating ? (
        <div
          className="border-border bg-muted/30 flex items-start gap-3 rounded-xl border px-4 py-3"
          aria-live="polite"
        >
          <Loader2 className="text-muted-foreground mt-0.5 size-4 shrink-0 motion-safe:animate-spin" aria-hidden />
          <div className="space-y-0.5">
            <p className="text-sm font-medium">AI sedang menerapkan enam lensa SCAMPER</p>
            <p className="rh-meta">
              Membaca bukti riset lalu menyusun alternatif per lensa. Halaman ini diperbarui otomatis.
            </p>
          </div>
        </div>
      ) : null}

      {data.ideas.length > 0 ? (
        <section aria-labelledby="innovation-metrics-title" className="flex flex-col gap-5">
          <h2 id="innovation-metrics-title" className="sr-only">Ringkasan sesi</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <Metric label="Ide disusun">{data.ideas.length}</Metric>
            <Metric label="Jadi konsep">{promotedCount}</Metric>
            <Metric label="Risiko pasar">{data.riskFactors.length}</Metric>
            <Metric label="Lensa terisi">
              {techniqueCounts.filter((t) => t.count > 0).length}
              <span className="text-muted-foreground text-sm font-normal"> / {SCAMPER_TECHNIQUES.length}</span>
            </Metric>
          </dl>
          <div>
            <p className="rh-meta mb-1.5">Ide per lensa</p>
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {techniqueCounts.map((t) => (
                <li key={t.key} className="rh-meta flex items-center gap-1.5">
                  <span>{t.label}</span>
                  <span className={cn("rh-num font-medium", t.count > 0 ? "text-foreground" : "text-muted-foreground")}>
                    {t.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {data.aiSummary || data.riskFactors.length > 0 ? (
        <div className="grid gap-8 lg:grid-cols-2">
          {data.aiSummary ? (
            <Section title="Ringkasan bukti riset">
              <p className="max-w-[68ch] text-sm leading-relaxed">{data.aiSummary}</p>
            </Section>
          ) : null}
          {data.riskFactors.length > 0 ? (
            <Section title="Risiko pasar" meta="Masalah dari riset yang menjadi dasar inovasi.">
              <ul className="divide-border flex flex-col divide-y">
                {data.riskFactors.map((r, i) => (
                  <li key={i} className="flex items-start gap-3 py-2 text-sm">
                    <span className={cn("w-14 shrink-0 text-xs font-medium", SEVERITY_META[r.severity].className)}>
                      {SEVERITY_META[r.severity].label}
                    </span>
                    <span className="min-w-0 flex-1">{r.label}</span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      ) : null}

      {data.ideas.length === 0 ? (
        isGenerating ? null : (
          <ResearchPanelEmpty
            icon={Lightbulb}
            title="Belum ada ide SCAMPER"
            description={
              data.status === "FAILED"
                ? "Penyusunan sebelumnya gagal. Susun ulang untuk mencoba lagi."
                : "Sesi ini belum menghasilkan ide. Susun ide agar AI menerapkan enam lensa SCAMPER."
            }
            action={
              <Button size="sm" onClick={handleRegenerate} disabled={pending}>
                <RefreshCw aria-hidden />
                Susun ide
              </Button>
            }
          />
        )
      ) : (
        SCAMPER_TECHNIQUES.map((tech) => {
          const ideas = data.ideas.filter((i) => i.technique === tech.key);
          if (ideas.length === 0) return null;
          return (
            <Section
              key={tech.key}
              title={tech.labelId}
              aside={tech.label}
              meta={tech.hint}
              count={ideas.length}
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
            </Section>
          );
        })
      )}

      <ConfirmDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        title={`Susun ulang ide "${data.baseProduct}"?`}
        description={`${data.ideas.length} ide yang ada akan diganti hasil baru. Konsep yang sudah dibuat dari ide tetap ada di Concept Lab.`}
        confirmLabel="Susun ulang ide"
        pending={pending}
        onConfirm={handleRegenerate}
      />
    </ResearchHubDetailPage>
  );
}
