"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, Loader2, Lightbulb, RefreshCw } from "lucide-react";
import { ProductInnovationStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  promoteIdeaToConcept,
  regenerateProductInnovation,
} from "@/actions/research-product-innovation";
import { actionErrorMessage } from "@/lib/action-error-message";
import { ScamperIdeaCard } from "@/components/research-hub/scamper-idea-card";
import { Button } from "@/components/ui/button";
import {
  hub,
  ResearchHubEmptyState,
  ResearchHubSection,
} from "@/components/research-hub/research-hub-primitives";
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

export function InnovationDetailClient({
  data,
}: {
  data: InnovationDetailData;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const isGenerating = data.status === "GENERATING";

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button
            size="sm"
            variant="ghost"
            render={<Link href="/research-hub/product-innovation" />}
          >
            <ArrowLeft className="mr-1.5 size-3.5" aria-hidden />
            Kembali
          </Button>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {data.baseProduct}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Kategori: {data.category}
            {data.targetMarket ? ` · ${data.targetMarket}` : ""}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRegenerate}
          disabled={pending || isGenerating}
        >
          <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
          Regenerate
        </Button>
      </div>

      {data.status === "FAILED" ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
          {data.errorMessage ?? "Generasi gagal. Coba regenerate."}
        </div>
      ) : null}

      {isGenerating ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> AI sedang menerapkan SCAMPER…
        </div>
      ) : null}

      {data.aiSummary ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {data.aiSummary}
        </p>
      ) : null}

      {data.riskFactors.length > 0 ? (
        <div className={cn(hub.panel)}>
          <p className={hub.label}>Faktor risiko pasar (dasar inovasi)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.riskFactors.map((r, i) => (
              <span
                key={i}
                className="bg-muted/60 rounded-md px-2 py-1 text-xs"
              >
                <span className="font-medium">[{r.severity}]</span> {r.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {data.ideas.length === 0 ? (
        !isGenerating ? (
          <ResearchHubEmptyState
            icon={Lightbulb}
            title="Belum ada ide"
            description="Belum ada alternatif SCAMPER. Coba regenerate."
          />
        ) : null
      ) : (
        SCAMPER_TECHNIQUES.map((tech) => {
          const ideas = data.ideas.filter((i) => i.technique === tech.key);
          if (ideas.length === 0) return null;
          return (
            <ResearchHubSection
              key={tech.key}
              title={`${tech.label} · ${tech.labelId}`}
              description={tech.hint}
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
            </ResearchHubSection>
          );
        })
      )}
    </div>
  );
}
