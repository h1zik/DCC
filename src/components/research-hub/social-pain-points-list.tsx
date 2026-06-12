import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
          className="border-border/60 flex items-start justify-between gap-3 rounded-lg border px-3 py-2"
        >
          <span className="text-sm leading-snug">{item.theme}</span>
          <span className="bg-rose-500/10 text-rose-700 dark:text-rose-300 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold">
            {item.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SocialPainPointsCard({ items }: { items: PainPointRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top Pain Points</CardTitle>
      </CardHeader>
      <CardContent>
        <SocialPainPointsList items={items} />
      </CardContent>
    </Card>
  );
}
