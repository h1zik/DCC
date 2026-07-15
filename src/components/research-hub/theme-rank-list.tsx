import { cn } from "@/lib/utils";

type Theme = { theme: string; count: number };

/**
 * Daftar peringkat tema — baris tile mini bento: kapsul nomor aksen,
 * bar proporsi relatif, dan pill jumlah. Visual-only; dipakai juga brand-hub.
 */
export function ThemeRankList({
  items,
  emptyLabel,
}: {
  items: Theme[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyLabel}</p>;
  }

  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <ol className="flex flex-col gap-1.5">
      {items.map((item, idx) => (
        <li
          key={item.theme}
          className="bg-muted/40 flex items-center gap-3 rounded-xl px-3 py-2.5"
        >
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums",
              "bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_14%,transparent)] text-[var(--lab-accent,var(--primary))]",
            )}
            aria-hidden
          >
            {idx + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium capitalize">
              {item.theme}
            </p>
            <div className="bg-muted mt-1.5 h-1 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-[var(--lab-accent,var(--primary))]"
                style={{ width: `${Math.max((item.count / max) * 100, 4)}%` }}
              />
            </div>
          </div>
          <span className="bg-card text-foreground shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums shadow-sm">
            {item.count.toLocaleString("id-ID")}
          </span>
        </li>
      ))}
    </ol>
  );
}
