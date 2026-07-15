import { hub } from "@/components/research-hub/research-hub-primitives";

export type WishlistRow = {
  theme: string;
  count: number;
  sampleText?: string;
};

/**
 * Daftar wishlist — baris tile mini dengan bar proporsi violet.
 * Visual-only; dipakai juga brand-hub.
 */
export function SocialWishlistList({ items }: { items: WishlistRow[] }) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada wishlist terdeteksi.</p>
    );
  }

  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <li
          key={`${item.theme}-${i}`}
          className="bg-muted/40 flex items-center gap-3 rounded-xl px-3 py-2.5"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug">{item.theme}</p>
            <div className="bg-muted mt-1.5 h-1 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-violet-500"
                style={{ width: `${Math.max((item.count / max) * 100, 4)}%` }}
              />
            </div>
          </div>
          <span className="shrink-0 rounded-lg bg-violet-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-violet-700 dark:text-violet-300">
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
      <p className="bento-label mb-3">Top Wishlist</p>
      <SocialWishlistList items={items} />
    </div>
  );
}
