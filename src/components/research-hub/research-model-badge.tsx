"use client";

import { Cpu } from "lucide-react";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import {
  formatModelShortName,
  formatTierModelLabel,
  type ResearchModuleAiProfile,
} from "@/lib/research/research-module-models";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TIER_STYLE: Record<"flash" | "pro", string> = {
  flash:
    "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200",
  pro: "border-violet-500/30 bg-violet-500/10 text-violet-800 dark:text-violet-200",
};

function StepBadge({
  step,
}: {
  step: ResearchAiMetaView["steps"][number];
}) {
  const providerLabel =
    step.provider === "ollama-cloud" ? "Ollama Cloud" : "Gemini";

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-normal", TIER_STYLE[step.tier])}
      title={`${step.label} · ${providerLabel} · ${step.generatedAt}`}
    >
      <span className="font-semibold">{formatModelShortName(step.model)}</span>
    </Badge>
  );
}

/** Badge dari metadata hasil analisis (disimpan di DB). */
export function ResearchModelBadgeGroup({
  meta,
  title = "Powered by",
  className,
}: {
  meta: ResearchAiMetaView | null | undefined;
  title?: string;
  className?: string;
}) {
  if (!meta?.steps?.length) return null;

  return (
    <div
      className={cn(
        "border-border/60 bg-muted/30 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2",
        className,
      )}
    >
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium">
        <Cpu className="size-3.5 shrink-0" aria-hidden />
        {title}
      </span>
      {meta.steps.map((step) => (
        <StepBadge key={`${step.label}-${step.tier}-${step.model}`} step={step} />
      ))}
    </div>
  );
}

/** Petunjuk tier default modul (statis, dari konfigurasi analyzer). */
export function ResearchModuleModelHint({
  profile,
  className,
}: {
  profile: ResearchModuleAiProfile;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border/50 bg-card text-muted-foreground flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs",
        className,
      )}
    >
      <Cpu className="size-3.5 shrink-0" aria-hidden />
      <span className="text-foreground font-medium">{profile.label}:</span>
      {profile.steps.map((step) => (
        <Badge
          key={`${step.label}-${step.tier}`}
          variant="outline"
          className={cn("font-normal", TIER_STYLE[step.tier])}
          title={step.label}
        >
          <span className="font-semibold">{formatTierModelLabel(step.tier)}</span>
          <span className="opacity-60"> — </span>
          <span className="opacity-90">{step.label}</span>
        </Badge>
      ))}
    </div>
  );
}
