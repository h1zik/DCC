import { cn } from "@/lib/utils";

export type ConceptValidationData = {
  marketDemand: number;
  differentiation: number;
  pricingFit: number;
  overall: number;
  risks: string[];
  aiSummary: string;
};

function scoreTone(score: number) {
  if (score >= 75) return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (score >= 50) return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-border bg-muted text-muted-foreground";
}

export function ConceptValidationPanel({ data }: { data: ConceptValidationData }) {
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
    </div>
  );
}
