import { cn } from "@/lib/utils";
import { AiFeedbackButtons } from "@/components/research-hub/ai-feedback-buttons";
import { ConceptValidationRadar } from "@/components/research-hub/concept-validation-radar";

export type ConceptDecision = "GO" | "PIVOT" | "NO_GO";

export type ConceptValidationData = {
  marketDemand: number;
  differentiation: number;
  pricingFit: number;
  overall: number;
  risks: string[];
  aiSummary: string;
  decision?: ConceptDecision;
  decisionReason?: string;
};

/** Tone mini-tile skor tinted berjenjang (tanpa border, ala bento). */
function scoreTone(score: number) {
  if (score >= 75)
    return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  if (score >= 50) return "bg-amber-500/12 text-amber-700 dark:text-amber-300";
  return "bg-muted/70 text-muted-foreground";
}

const DECISION_META: Record<
  ConceptDecision,
  { label: string; className: string }
> = {
  GO: {
    label: "GO",
    className: "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200",
  },
  PIVOT: {
    label: "PIVOT",
    className: "bg-amber-500/12 text-amber-800 dark:text-amber-200",
  },
  NO_GO: {
    label: "NO-GO",
    className: "bg-rose-500/12 text-rose-800 dark:text-rose-200",
  },
};

export function ConceptValidationPanel({
  data,
  conceptId,
}: {
  data: ConceptValidationData;
  /** Untuk feedback thumbs pada hasil validasi (opsional). */
  conceptId?: string;
}) {
  if (!data.overall && !data.aiSummary) {
    return (
      <p className="text-muted-foreground text-sm">
        Belum divalidasi. Klik Validasi untuk menilai konsep.
      </p>
    );
  }

  const scores = [
    { label: "Market Demand", value: data.marketDemand },
    { label: "Differentiation", value: data.differentiation },
    { label: "Pricing Fit", value: data.pricingFit },
    { label: "Overall", value: data.overall },
  ];

  const decision = data.decision ?? "PIVOT";
  const decisionMeta = DECISION_META[decision];

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-4 py-3.5",
          decisionMeta.className,
        )}
      >
        <span className="text-xl font-extrabold tracking-tight">
          {decisionMeta.label}
        </span>
        {data.decisionReason ? (
          <span className="text-sm leading-snug">{data.decisionReason}</span>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid grid-cols-2 gap-2.5">
          {scores.map((s) => (
            <div
              key={s.label}
              className={cn(
                "flex flex-col items-start justify-between gap-1 rounded-xl px-3.5 py-3",
                scoreTone(s.value),
              )}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                {s.label}
              </span>
              <span className="text-2xl font-extrabold tabular-nums tracking-tight">
                {Math.round(s.value)}
                <span className="text-sm font-bold opacity-50">/100</span>
              </span>
            </div>
          ))}
        </div>
        <ConceptValidationRadar
          marketDemand={data.marketDemand}
          differentiation={data.differentiation}
          pricingFit={data.pricingFit}
          overall={data.overall}
        />
      </div>

      {data.aiSummary ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {data.aiSummary}
        </p>
      ) : null}
      {data.risks.length > 0 ? (
        <div>
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
            Risiko
          </p>
          <ul className="mt-1.5 space-y-1.5 text-sm">
            {data.risks.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-rose-400"
                  aria-hidden
                />
                {r}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-muted-foreground border-border/60 border-t pt-3 text-[11px] leading-relaxed">
        Metodologi: skor mentah dari AI, lalu dikoreksi deterministik — penalti
        bila harga target menyimpang jauh dari rentang harga kompetitor, dan
        skor overall dibatasi maksimal 72 bila konteks riset &le; 1 modul.
        Skor adalah estimasi berbasis data internal, bukan riset pasar
        tervalidasi eksternal.
      </p>

      {conceptId ? (
        <AiFeedbackButtons
          module="concept-lab"
          artifactType="concept-validation"
          artifactId={conceptId}
          label="Hasil validasi ini akurat?"
        />
      ) : null}
    </div>
  );
}
