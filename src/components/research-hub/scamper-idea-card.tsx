"use client";

import Link from "next/link";
import { ArrowRight, Check, Lightbulb, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScamperIdea } from "@/lib/research/product-innovation/types";
import { cn } from "@/lib/utils";

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-0.5 text-sm leading-relaxed">{value}</p>
    </div>
  );
}

export function ScamperIdeaCard({
  idea,
  promoting,
  onPromote,
}: {
  idea: ScamperIdea;
  promoting: boolean;
  onPromote: () => void;
}) {
  const promoted = !!idea.promotedConceptId;

  return (
    <article className="bento-tile justify-start gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_12%,transparent)] text-[var(--lab-accent,var(--primary))]"
            aria-hidden
          >
            <Lightbulb className="size-4.5" />
          </span>
          <h4 className="pt-1 text-sm font-bold leading-snug tracking-tight">
            {idea.title}
          </h4>
        </div>
        {promoted ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            <Check className="size-3" aria-hidden />
            Dipromosikan
          </span>
        ) : null}
      </div>

      {idea.description ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {idea.description}
        </p>
      ) : null}

      <div className="space-y-2.5">
        <Field label="Perubahan" value={idea.change} />
        <Field label="Manfaat" value={idea.benefit} />
        <Field label="Alasan (evidence)" value={idea.rationale} />
        <Field label="Kelayakan" value={idea.feasibilityNote} />
      </div>

      <div
        className={cn("border-border/60 mt-auto border-t pt-3")}
      >
        {promoted ? (
          <Button
            size="sm"
            variant="outline"
            render={
              <Link
                href={`/research-hub/concept-lab/${idea.promotedConceptId}`}
              />
            }
          >
            <Check className="mr-1.5 size-3.5" aria-hidden />
            Lihat konsep
          </Button>
        ) : (
          <Button size="sm" onClick={onPromote} disabled={promoting}>
            <Sparkles className="mr-1.5 size-3.5" aria-hidden />
            Promote ke Concept Lab
            <ArrowRight className="ml-1.5 size-3.5" aria-hidden />
          </Button>
        )}
      </div>
    </article>
  );
}
