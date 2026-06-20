import { hub } from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";

export type ClaimAnalysisData = {
  overused?: string[];
  underserved?: string[];
};

export function ClaimAnalysisPanel({ data }: { data: ClaimAnalysisData }) {
  const overused = data.overused ?? [];
  const underserved = data.underserved ?? [];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className={hub.panel}>
        <p className="mb-3 text-sm font-medium">Klaim Overused</p>
        {overused.length === 0 ? (
          <p className="text-muted-foreground text-sm">—</p>
        ) : (
          <ul className="space-y-2">
            {overused.map((item, i) => (
              <li key={`over-${i}`} className={cn(hub.nestedPanel, "text-sm")}>
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={hub.panel}>
        <p className="mb-3 text-sm font-medium">Klaim Underserved</p>
        {underserved.length === 0 ? (
          <p className="text-muted-foreground text-sm">—</p>
        ) : (
          <ul className="space-y-2">
            {underserved.map((item, i) => (
              <li
                key={`under-${i}`}
                className={cn(
                  hub.nestedPanel,
                  "border-emerald-500/30 text-sm",
                )}
              >
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
