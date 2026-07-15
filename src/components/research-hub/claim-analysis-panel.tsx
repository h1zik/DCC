import { cn } from "@/lib/utils";

export type ClaimAnalysisData = {
  overused?: string[];
  underserved?: string[];
};

function ClaimList({
  title,
  hint,
  items,
  dot,
  rowClass,
}: {
  title: string;
  hint: string;
  items: string[];
  dot: string;
  rowClass: string;
}) {
  return (
    <div className="bento-tile justify-start gap-3">
      <div className="flex items-center gap-2">
        <span className={cn("size-2 shrink-0 rounded-full", dot)} aria-hidden />
        <span className="bento-label flex-1">{title}</span>
        <span className="text-muted-foreground text-[11px] tabular-nums">
          {items.length}
        </span>
      </div>
      <p className="text-muted-foreground -mt-1 text-[11px] leading-relaxed">
        {hint}
      </p>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">—</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item, i) => (
            <li
              key={`${title}-${i}`}
              className={cn("rounded-xl px-3 py-2 text-sm leading-snug", rowClass)}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ClaimAnalysisPanel({ data }: { data: ClaimAnalysisData }) {
  const overused = data.overused ?? [];
  const underserved = data.underserved ?? [];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <ClaimList
        title="Klaim overused"
        hint="Sudah ramai dipakai kompetitor — sulit menonjol di klaim ini."
        items={overused}
        dot="bg-amber-400"
        rowClass="bg-muted/50"
      />
      <ClaimList
        title="Klaim underserved"
        hint="Masih jarang diklaim — kandidat celah positioning."
        items={underserved}
        dot="bg-emerald-500"
        rowClass="bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
      />
    </div>
  );
}
