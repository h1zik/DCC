import {
  OUTGOING_CATEGORIES,
  OUTGOING_CATEGORY_COLOR_VAR,
  OUTGOING_CATEGORY_LABELS,
  type CategoryPcs,
  type OutgoingCategory,
} from "@/lib/outgoing-metrics";
import { cn } from "@/lib/utils";

/** Kategori yang ditampilkan: 4 utama selalu, "Tanpa kategori" hanya bila ada. */
export function visibleOutgoingCategories(totals: CategoryPcs): OutgoingCategory[] {
  return OUTGOING_CATEGORIES.filter((c) => c !== "other" || totals.other > 0);
}

export function formatPcs(n: number): string {
  return n.toLocaleString("id-ID");
}

function sharePct(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${((part / total) * 100).toLocaleString("id-ID", {
    maximumFractionDigits: 1,
  })}%`;
}

/**
 * Bar komposisi 100% — ≤ 5 bagian, jadi satu bar tersegmentasi lebih terbaca
 * daripada donut. Celah 2px memisahkan segmen tanpa mengandalkan warna saja.
 */
export function OutgoingCompositionBar({
  totals,
  className,
}: {
  totals: CategoryPcs;
  className?: string;
}) {
  const total = OUTGOING_CATEGORIES.reduce((acc, c) => acc + totals[c], 0);
  const parts = OUTGOING_CATEGORIES.filter((c) => totals[c] > 0);
  const summary = parts
    .map((c) => `${OUTGOING_CATEGORY_LABELS[c]} ${sharePct(totals[c], total)}`)
    .join(", ");
  return (
    <div
      role="img"
      aria-label={`Komposisi barang keluar: ${summary || "belum ada data"}`}
      className={cn("flex h-3 w-full gap-0.5 overflow-hidden rounded-full", className)}
    >
      {parts.length === 0 ? (
        <span className="h-full w-full rounded-full bg-muted/60" />
      ) : (
        parts.map((c) => (
          <span
            key={c}
            className="h-full min-w-1 rounded-[3px] first:rounded-l-full last:rounded-r-full"
            style={{
              flexGrow: totals[c],
              flexBasis: 0,
              background: OUTGOING_CATEGORY_COLOR_VAR[c],
            }}
          />
        ))
      )}
    </div>
  );
}

/** Legend bersama: swatch · label · pcs · % — teks selalu warna tinta. */
export function OutgoingCategoryLegend({
  totals,
  className,
}: {
  totals: CategoryPcs;
  className?: string;
}) {
  const total = OUTGOING_CATEGORIES.reduce((acc, c) => acc + totals[c], 0);
  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4",
        totals.other > 0 && "sm:grid-cols-5",
        className,
      )}
    >
      {visibleOutgoingCategories(totals).map((c) => (
        <li key={c} className="flex min-w-0 items-start gap-2">
          <span
            aria-hidden
            className="mt-1 size-2.5 shrink-0 rounded-[3px]"
            style={{ background: OUTGOING_CATEGORY_COLOR_VAR[c] }}
          />
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">
              {OUTGOING_CATEGORY_LABELS[c]}
            </p>
            <p className="font-mono text-sm font-medium tabular-nums text-foreground">
              {formatPcs(totals[c])}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {sharePct(totals[c], total)}
              </span>
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
