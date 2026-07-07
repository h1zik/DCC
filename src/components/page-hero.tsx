import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PageHeroVariant = "default" | "compact";

/**
 * Hero header konsisten untuk halaman top-level: ikon + judul + subtitle,
 * dengan slot kanan untuk action / stat chip / kontrol.
 *
 * Varian:
 * - `default` — banner penuh (kartu + gradient + glow) untuk halaman
 *   landing/overview sejati (mis. Home, dashboard eksekutif).
 * - `compact` — kartu ramping, dekorasi diredam, untuk halaman list/kerja yang
 *   statistik ringkasnya tetap ingin ditonjolkan.
 */
export function PageHero({
  icon: Icon,
  title,
  subtitle,
  children,
  right,
  variant = "default",
  className,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: React.ReactNode;
  /** Konten ekstra di bawah subtitle (chip stat, dll). */
  children?: React.ReactNode;
  /** Slot kanan (search, period selector, button). */
  right?: React.ReactNode;
  /** Bobot visual banner. Default `default`. */
  variant?: PageHeroVariant;
  className?: string;
}) {
  const compact = variant === "compact";

  return (
    <header
      className={cn(
        "border-border bg-card relative isolate overflow-hidden border shadow-sm",
        compact ? "rounded-xl" : "rounded-2xl",
        "animate-in fade-in slide-in-from-top-1 duration-300 motion-reduce:animate-none",
        "transition-shadow duration-300 ease-out",
        className,
      )}
    >
      {/* Dekorasi berlapis (gradient + blob + hairline) pada default; pada compact
          dipangkas jadi gradient sangat tipis + hairline agar tidak "ramai". */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br to-transparent",
          compact
            ? "from-primary/[0.06] via-transparent"
            : "from-primary/10 via-primary/5",
        )}
        aria-hidden
      />
      {!compact ? (
        <div
          className="bg-primary/15 absolute -top-16 -right-16 size-44 rounded-full blur-3xl"
          aria-hidden
        />
      ) : null}
      <div
        className="bg-gradient-to-r from-transparent via-primary/40 to-transparent absolute inset-x-0 top-0 h-px"
        aria-hidden
      />
      <div
        className={cn(
          "relative flex flex-col sm:flex-row sm:justify-between",
          compact
            ? "gap-2.5 p-4 sm:items-center sm:gap-4"
            : "gap-4 p-5 sm:items-end sm:gap-6 sm:p-6",
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "border-primary/30 bg-primary/10 text-primary flex shrink-0 items-center justify-center border",
              compact ? "size-9 rounded-lg" : "size-11 rounded-xl",
            )}
            aria-hidden
          >
            <Icon className={compact ? "size-4" : "size-5"} />
          </span>
          <div className="min-w-0 space-y-1">
            <h1
              className={cn(
                "text-foreground font-semibold tracking-tight",
                compact ? "text-lg sm:text-xl" : "text-2xl sm:text-3xl",
              )}
            >
              {title}
            </h1>
            {subtitle ? (
              <p
                className={cn(
                  "text-muted-foreground text-pretty leading-relaxed",
                  compact ? "text-xs" : "text-sm",
                )}
              >
                {subtitle}
              </p>
            ) : null}
            {children}
          </div>
        </div>
        {right ? (
          <div
            className={cn(
              "flex flex-wrap items-center gap-2 self-start",
              compact ? "sm:self-center" : "sm:self-end",
            )}
          >
            {right}
          </div>
        ) : null}
      </div>
    </header>
  );
}

/** Chip kecil ber-shadow halus untuk dipakai di slot kanan PageHero. */
export function PageHeroChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-border bg-background text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm">
      {children}
    </span>
  );
}
