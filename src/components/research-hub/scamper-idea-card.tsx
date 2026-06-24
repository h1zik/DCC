"use client";

import Link from "next/link";
import { ArrowRight, Check, Lightbulb, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hub } from "@/components/research-hub/research-hub-primitives";
import type { ScamperIdea } from "@/lib/research/product-innovation/types";
import { cn } from "@/lib/utils";

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className={hub.label}>{label}</p>
      <p className="text-sm leading-relaxed">{value}</p>
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
    <article className={cn(hub.panel, "flex flex-col gap-3")}>
      <div className="flex items-start gap-2">
        <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/20">
          <Lightbulb className="size-4" aria-hidden />
        </span>
        <h4 className="text-sm font-semibold leading-tight">{idea.title}</h4>
      </div>

      {idea.description ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {idea.description}
        </p>
      ) : null}

      <div className="space-y-2">
        <Field label="Perubahan" value={idea.change} />
        <Field label="Manfaat" value={idea.benefit} />
        <Field label="Alasan (evidence)" value={idea.rationale} />
        <Field label="Kelayakan" value={idea.feasibilityNote} />
      </div>

      <div className="mt-1 border-t border-border/40 pt-3">
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
