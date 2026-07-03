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

function scoreTone(score: number) {
  if (score >= 75) return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (score >= 50) return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-border bg-muted text-muted-foreground";
}

const DECISION_META: Record<
  ConceptDecision,
  { label: string; className: string }
> = {
  GO: {
    label: "GO",
    className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  PIVOT: {
    label: "PIVOT",
    className: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  NO_GO: {
    label: "NO-GO",
    className: "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300",
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
          "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3",
          decisionMeta.className,
        )}
      >
        <span className="text-lg font-bold tracking-wide">{decisionMeta.label}</span>
        {data.decisionReason ? (
          <span className="text-sm">{data.decisionReason}</span>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid grid-cols-2 gap-3">
          {scores.map((s) => (
            <div
              key={s.label}
              className={cn(
                "flex flex-col items-center rounded-xl border px-3 py-3",
                scoreTone(s.value),
              )}
            >
              <span className="text-2xl font-bold tabular-nums">{Math.round(s.value)}</span>
              <span className="text-center text-[10px] font-semibold uppercase">
                {s.label}
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
        <p className="text-muted-foreground text-sm leading-relaxed">{data.aiSummary}</p>
      ) : null}
      {data.risks.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Risiko</p>
          <ul className="mt-1 space-y-1 text-sm">
            {data.risks.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-muted-foreground text-[11px] leading-relaxed">
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
