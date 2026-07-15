import { Sparkles } from "lucide-react";

/**
 * Inline disclaimer for numbers/charts that are AI-generated judgments rather than
 * measured data (e.g. USP differentiation scores, positioning coordinates, confidence
 * percentages). Prevents LLM opinions from being read as quantitative ground truth.
 */
export function AiEstimateNote({
  children = "Estimasi AI — penilaian kualitatif, bukan data terukur. Verifikasi sebelum dipakai untuk keputusan.",
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`text-muted-foreground bg-muted/50 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] leading-relaxed ${className}`}
    >
      <Sparkles className="size-3 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
