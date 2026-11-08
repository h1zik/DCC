import { FileText, Globe } from "lucide-react";
import { TrendConfidenceBadge } from "@/components/research-hub/trend-confidence-badge";
import { TrendDimensionBadge } from "@/components/research-hub/trend-dimension-badge";
import { TrendEvidenceTable } from "@/components/research-hub/trend-evidence-table";
import { TrendWowBadge } from "@/components/research-hub/trend-wow-badge";
import { Button } from "@/components/ui/button";
import { TREND_PHASE_LABELS } from "@/lib/research/labels";
import { cn } from "@/lib/utils";
import type { TrendDetailData } from "./trend-detail-client";

type TrendItem = TrendDetailData["items"][number];

/** Satu tren di tab Tren: badge, narasi, bukti sinyal, produk terkait. */
export function TrendItemDetail({
  item,
  highlighted,
  exploreDisabledReason,
  onExplore,
}: {
  item: TrendItem;
  highlighted: boolean;
  /**
   * Non-null = tombol dinonaktifkan. Teks tampil di bawah tombol; string
   * kosong bila alasannya sudah dijelaskan sekali di level tab.
   */
  exploreDisabledReason: string | null;
  onExplore: () => void;
}) {
  const score = item.tmiScore ?? item.score;

  return (
    <article
      id={item.id}
      aria-labelledby={`${item.id}-title`}
      className={cn(
        "border-border bg-card flex scroll-mt-24 flex-col gap-4 rounded-xl border p-5",
        highlighted &&
          "animate-in fade-in ring-2 ring-[var(--lab-accent,var(--primary))] duration-300 motion-reduce:animate-none",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h3 id={`${item.id}-title`} className="text-base font-semibold tracking-tight">
            {item.name}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <TrendDimensionBadge dimension={item.dimension} />
            <span className="bg-muted/70 text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
              {TREND_PHASE_LABELS[item.phase]}
            </span>
            {typeof score === "number" ? (
              <TrendConfidenceBadge confidence={item.confidence} tmiScore={score} />
            ) : null}
            <TrendWowBadge status={item.wowStatus} />
            {item.isGlobalPipeline ? (
              <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                <Globe className="size-3" aria-hidden />
                Global ke lokal
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={exploreDisabledReason != null}
            aria-describedby={exploreDisabledReason ? `${item.id}-explore-hint` : undefined}
            onClick={onExplore}
          >
            <FileText aria-hidden />
            Jadikan ide produk
          </Button>
          {exploreDisabledReason ? (
            <p id={`${item.id}-explore-hint`} className="rh-meta max-w-[16rem] text-right">
              {exploreDisabledReason}
            </p>
          ) : null}
        </div>
      </div>

      {item.narrative ? (
        <p className="text-foreground/90 max-w-[72ch] text-sm leading-relaxed">
          {item.narrative}
        </p>
      ) : null}

      {item.evidence.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">Bukti sinyal</h4>
          <TrendEvidenceTable evidence={item.evidence} />
        </div>
      ) : item.sources.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">Sumber data</h4>
          <ul className="text-muted-foreground space-y-1 text-sm">
            {item.sources.map((s, idx) => (
              <li key={idx}>
                <span className="text-foreground font-medium">{s.type}:</span>{" "}
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="focus-visible:ring-ring rounded hover:underline focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {s.snippet}
                  </a>
                ) : (
                  s.snippet
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {item.relatedProducts.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">Produk terkait</h4>
          <ul className="flex flex-wrap gap-1.5">
            {item.relatedProducts.map((p) => (
              <li key={p} className="bg-muted/60 rounded-full px-2.5 py-1 text-xs">
                {p}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
