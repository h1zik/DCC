import { cn } from "@/lib/utils";

type Accent = "rose" | "emerald" | "sky" | "violet" | "amber" | "neutral";

type Props = {
  title: React.ReactNode;
  description?: React.ReactNode;
  accent?: Accent;
  /** Konten kanan header, mis. tombol aksi atau metadata. */
  right?: React.ReactNode;
  /** Padding lebih kompak untuk panel data. */
  compact?: boolean;
  className?: string;
  children: React.ReactNode;
};

const DOT: Record<Accent, string> = {
  rose: "bg-rose-500",
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  neutral: "bg-foreground/40",
};

/**
 * Kartu seksi standar untuk modul keuangan: judul + dot warna +
 * konten. Memberi visual hierarchy yang konsisten antar halaman.
 */
export function FinanceSectionCard({
  title,
  description,
  accent = "neutral",
  right,
  compact,
  className,
  children,
}: Props) {
  return (
    <section
      className={cn(
        "border-border bg-card flex flex-col gap-3 rounded-xl border shadow-sm",
        compact ? "p-3" : "p-4",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <h2 className="text-foreground inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span aria-hidden className={cn("size-2 rounded-full", DOT[accent])} />
            {title}
          </h2>
          {description ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
        {right ? <div className="flex items-center gap-2">{right}</div> : null}
      </header>
      {children}
    </section>
  );
}
