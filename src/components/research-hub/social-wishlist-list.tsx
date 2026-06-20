import { hub } from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";

export type WishlistRow = {
  theme: string;
  count: number;
  sampleText?: string;
};

export function SocialWishlistList({ items }: { items: WishlistRow[] }) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada wishlist terdeteksi.</p>
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
          <span className="bg-violet-500/10 text-violet-700 dark:text-violet-300 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums">
            {item.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SocialWishlistCard({
  items,
  bare = false,
}: {
  items: WishlistRow[];
  bare?: boolean;
}) {
  if (bare) return <SocialWishlistList items={items} />;
  return (
    <div className={hub.panel}>
      <p className="mb-3 text-sm font-semibold">Top Wishlist</p>
      <SocialWishlistList items={items} />
    </div>
  );
}
