import { hub } from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";

export type PainPointRow = {
  theme: string;
  count: number;
  sampleText?: string;
};

export function SocialPainPointsList({ items }: { items: PainPointRow[] }) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada pain point terdeteksi.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li
          key={`${item.theme}-${i}`}
          className={cn(
            hub.nestedPanel,
            "flex items-start justify-between gap-3",
          )}
        >
          <span className="text-sm leading-snug">{item.theme}</span>
          <span className="bg-rose-500/10 text-rose-700 dark:text-rose-300 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums">
            {item.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SocialPainPointsCard({
  items,
  bare = false,
}: {
  items: PainPointRow[];
  bare?: boolean;
}) {
  if (bare) return <SocialPainPointsList items={items} />;
  return (
    <div className={hub.panel}>
      <p className="mb-3 text-sm font-semibold">Top Pain Points</p>
      <SocialPainPointsList items={items} />
    </div>
  );
}
