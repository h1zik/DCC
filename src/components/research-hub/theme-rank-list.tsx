import { hub } from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";

type Theme = { theme: string; count: number };

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

  return (
    <ol className="space-y-2">
      {items.map((item, idx) => (
        <li
          key={item.theme}
          className={cn(
            hub.nestedPanel,
            "flex items-start justify-between gap-3 text-sm",
          )}
        >
          <span className="text-foreground min-w-0 flex-1">
            <span className="bg-primary/15 text-primary mr-2 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums">
              {idx + 1}
            </span>
            <span className="capitalize">{item.theme}</span>
          </span>
          <span className="text-muted-foreground shrink-0 tabular-nums">
            {item.count.toLocaleString("id-ID")}
          </span>
        </li>
      ))}
    </ol>
  );
}
