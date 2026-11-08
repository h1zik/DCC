import { cn } from "@/lib/utils";
import { RUN_TONE_LABEL, type RunTone } from "./run-status";

export type RunLedgerCounts = Partial<Record<RunTone, number>>;

const ORDER: RunTone[] = ["ready", "running", "failed", "idle"];

/**
 * Ledger status run satu modul: total + bar proporsional siap/berjalan/gagal.
 * Menggantikan deretan tile statistik berwarna — satu baris yang langsung
 * menjawab "berapa yang sudah bisa dibaca, berapa yang masih jalan".
 */
export function RunLedger({
  counts,
  noun,
  detail,
  labels,
  className,
}: {
  counts: RunLedgerCounts;
  /** Kata benda run, mis. "pencarian", "sumber review". */
  noun: string;
  /** Keterangan tambahan di kanan (mis. "1.240 produk terkumpul"). */
  detail?: React.ReactNode;
  /** Ganti label tone (mis. running → "Scraping"). */
  labels?: Partial<Record<RunTone, string>>;
  className?: string;
}) {
  const total = ORDER.reduce((sum, tone) => sum + (counts[tone] ?? 0), 0);
  if (total === 0) return null;

  const present = ORDER.filter((tone) => (counts[tone] ?? 0) > 0);
  const summary = present
    .map((tone) => `${counts[tone]} ${(labels?.[tone] ?? RUN_TONE_LABEL[tone]).toLowerCase()}`)
    .join(", ");

  return (
    <section
      aria-label={`Status ${noun}`}
      className={cn("flex flex-col gap-2.5", className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-foreground text-sm">
          <span className="rh-num text-xl font-semibold tracking-tight">
            {total.toLocaleString("id-ID")}
          </span>{" "}
          <span className="text-muted-foreground">{noun}</span>
        </p>
        {detail ? <p className="rh-meta rh-num">{detail}</p> : null}
      </div>

      <div className="rh-ledger-bar" role="img" aria-label={summary}>
        {present.map((tone) => (
          <span
            key={tone}
            className={cn("rh-ledger-seg", `rh-tone-${tone}`)}
            style={{ flexGrow: counts[tone] ?? 0, flexBasis: 0 }}
          />
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1">
        {present.map((tone) => (
          <li key={tone} className="rh-meta flex items-center gap-1.5">
            <span className={cn("rh-dot", `rh-tone-${tone}`)} aria-hidden />
            <span>{labels?.[tone] ?? RUN_TONE_LABEL[tone]}</span>
            <span className="rh-num text-foreground font-medium">
              {(counts[tone] ?? 0).toLocaleString("id-ID")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Hitung counts ledger dari daftar baris + fungsi pemetaan tone. */
export function countRunTones<T>(rows: T[], toneOf: (row: T) => RunTone): RunLedgerCounts {
  const counts: RunLedgerCounts = {};
  for (const row of rows) {
    const tone = toneOf(row);
    counts[tone] = (counts[tone] ?? 0) + 1;
  }
  return counts;
}
