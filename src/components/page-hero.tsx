import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hero header konsisten untuk halaman top-level: ikon + judul + subtitle,
 * dengan slot kanan untuk action / stat chip / kontrol.
 */
export function PageHero({
  icon: Icon,
  title,
  subtitle,
  children,
  right,
  className,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: React.ReactNode;
  /** Konten ekstra di bawah subtitle (chip stat, dll). */
  children?: React.ReactNode;
  /** Slot kanan (search, period selector, button). */
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "border-border bg-card relative isolate overflow-hidden rounded-2xl border shadow-sm",
        className,
      )}
    >
      <div
        className="bg-gradient-to-br from-primary/10 via-primary/5 absolute inset-0 to-transparent"
        aria-hidden
      />
      <div
        className="bg-primary/15 absolute -top-16 -right-16 size-56 rounded-full blur-3xl"
        aria-hidden
      />
      <div
        className="bg-gradient-to-r from-transparent via-primary/40 to-transparent absolute inset-x-0 top-0 h-px"
        aria-hidden
      />
      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="border-primary/30 bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl border"
            aria-hidden
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-muted-foreground text-pretty text-sm leading-relaxed">
                {subtitle}
              </p>
            ) : null}
            {children}
          </div>
        </div>
        {right ? (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-end">
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
