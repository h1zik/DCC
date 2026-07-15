import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Primitives halaman Dominatus Lab — penerus `research-hub-primitives` untuk
 * halaman di dalam Lab. API sengaja identik dengan padanan ResearchHub* agar
 * migrasi halaman = tukar import + nama komponen.
 *
 * Warna dasar dari palet takeover Lab (token semantik); aksen modul dari
 * `--lab-accent`/`--lab-accent-2` yang di-set layout tiap modul.
 */
export const lab = {
  page: "flex w-full flex-col gap-8 pb-12",
  section: "flex flex-col gap-4",
  sectionTitle: "text-base font-semibold tracking-tight text-foreground",
  sectionDesc: "text-muted-foreground text-sm leading-relaxed",
  // Prefiks `lab-*` di bawah = marker class yang di-reskin lab-bento.css
  // (skin "Bento Studio" global Lab) — tidak punya style sendiri di luar itu.
  card: "lab-card relative overflow-hidden rounded-2xl border border-border bg-card/70 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.35),inset_0_1px_0_var(--lab-highlight)] backdrop-blur-xl",
  cardHover:
    "transition-[transform,box-shadow,border-color] duration-300 ease-out motion-reduce:transition-none hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--lab-accent,var(--primary))_35%,var(--border))] hover:shadow-[0_20px_50px_-16px_rgb(0_0_0/0.5),0_0_60px_-24px_var(--lab-accent,var(--primary))] motion-reduce:hover:translate-y-0",
  cardBody: "p-5 sm:p-6",
  panel:
    "lab-panel rounded-2xl border border-border bg-card/60 p-5 shadow-[inset_0_1px_0_var(--lab-highlight)] backdrop-blur-xl",
  nestedPanel: "lab-nested-panel rounded-xl border border-border/60 bg-muted/20 p-4",
  label:
    "lab-label text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--lab-accent,var(--primary))]",
  stickyToolbar:
    "border-border/70 bg-background/70 sticky top-14 z-20 -mt-2 border-b backdrop-blur-xl",
  entrance:
    "animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none",
} as const;

export function LabPageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(lab.page, className)}>{children}</div>;
}

/**
 * Header halaman Lab — TANPA kotak kartu: duduk langsung di atas latar aurora,
 * dipisah hairline gradient aksen. `titleAccent` merender kata terakhir judul
 * dengan gradient duo aksen modul.
 */
export function LabPageHeader({
  icon: Icon,
  eyebrow,
  title,
  titleAccent,
  description,
  right,
  footer,
  backHref,
  backLabel,
  variant = "default",
  className,
}: {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  /** Bagian judul yang dirender bergradasi aksen (ditaruh setelah `title`). */
  titleAccent?: string;
  description?: ReactNode;
  right?: ReactNode;
  footer?: ReactNode;
  /** Link kembali (dipakai halaman detail). */
  backHref?: string;
  backLabel?: string;
  variant?: "default" | "compact" | "detail";
  className?: string;
}) {
  const isCompact = variant === "compact";

  return (
    <header className={cn(lab.entrance, "relative isolate", className)}>
      <div
        className={cn(
          "flex flex-col gap-4",
          right ? "sm:flex-row sm:items-end sm:justify-between" : "",
        )}
      >
        <div className="flex min-w-0 items-start gap-4">
          {Icon ? (
            <span
              className={cn(
                "lab-chip flex shrink-0 items-center justify-center rounded-2xl",
                isCompact ? "size-10" : "size-12",
              )}
              aria-hidden
            >
              <Icon className={isCompact ? "size-5" : "size-6"} />
            </span>
          ) : null}
          <div className="min-w-0 space-y-2">
            {backHref ? (
              <Link
                href={backHref}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
              >
                <ArrowLeft className="size-3.5" />
                {backLabel ?? "Kembali"}
              </Link>
            ) : null}
            {eyebrow ? <p className={lab.label}>{eyebrow}</p> : null}
            <h1
              className={cn(
                "text-foreground text-balance font-bold tracking-tight",
                isCompact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl",
              )}
            >
              {title}
              {titleAccent ? (
                <>
                  {" "}
                  <span className="lab-text-accent">{titleAccent}</span>
                </>
              ) : null}
            </h1>
            {description ? (
              <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed sm:text-[15px]">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {right ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {right}
          </div>
        ) : null}
      </div>
      {footer ? <div className="mt-4">{footer}</div> : null}
      <div
        className="mt-5 h-px bg-gradient-to-r from-[color-mix(in_srgb,var(--lab-accent,var(--primary))_40%,transparent)] via-border to-transparent"
        aria-hidden
      />
    </header>
  );
}

export function LabSection({
  title,
  description,
  action,
  children,
  className,
  delayMs = 0,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  return (
    <section
      className={cn(lab.section, lab.entrance, className)}
      style={delayMs > 0 ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={lab.sectionTitle}>{title}</h2>
          {description ? (
            <p className={lab.sectionDesc}>{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Kartu glass Lab. `interactive` menambah hover lift+glow; `href` menjadikannya Link. */
export function LabCard({
  interactive,
  href,
  className,
  children,
  ...props
}: {
  interactive?: boolean;
  href?: string;
  className?: string;
  children: ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "className" | "children">) {
  const classes = cn(lab.card, interactive && lab.cardHover, className);
  if (href) {
    return (
      <Link href={href} className={cn(classes, "block")}>
        {children}
      </Link>
    );
  }
  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

export function LabEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "lab-empty border-border/70 relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-dashed bg-card/30 px-8 py-14 text-center backdrop-blur-sm",
        "animate-in fade-in duration-500 motion-reduce:animate-none",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,color-mix(in_srgb,var(--lab-accent,var(--primary))_10%,transparent),transparent_70%)]"
        aria-hidden
      />
      {Icon ? (
        <span className="relative flex size-12 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_12%,transparent)] text-[var(--lab-accent,var(--primary))]">
          <Icon className="size-6" />
        </span>
      ) : null}
      <div className="relative max-w-md space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="relative">{action}</div> : null}
    </div>
  );
}

export function LabStatChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent" | "primary";
}) {
  const tones = {
    neutral: "bg-muted/60 text-foreground",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    warning: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
    danger: "bg-red-500/10 text-red-700 dark:text-red-300",
    accent:
      "bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_10%,transparent)] text-[var(--lab-accent,var(--primary))]",
    // Alias kompatibilitas dengan ResearchHubStatChip.
    primary: "bg-primary/10 text-primary",
  };
  return (
    <div
      className={cn(
        "lab-stat-chip border-border/60 inline-flex flex-col gap-0.5 rounded-xl border px-3 py-2 backdrop-blur-sm",
        tones[tone],
      )}
    >
      <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/** Baris toolbar filter/form Lab. */
export function LabToolbar({
  children,
  sticky,
  className,
}: {
  children: ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        sticky
          ? lab.stickyToolbar
          : "lab-toolbar border-border rounded-2xl border bg-card/50 backdrop-blur-xl",
        "flex flex-wrap items-center gap-2 p-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Skeleton halaman standar untuk `loading.tsx` di dalam Lab. */
export function LabSkeletonPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="lab-shimmer h-8 w-64" />
        <Skeleton className="lab-shimmer h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="lab-shimmer h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="lab-shimmer h-72 w-full rounded-2xl" />
    </div>
  );
}

/** Sidebar daftar dokumen (padanan BrandHubDocumentSidebar). */
export function LabDocumentSidebar({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "flex w-full shrink-0 flex-col gap-3 lg:w-60 xl:w-64",
        className,
      )}
    >
      {title || action ? (
        <div className="flex items-center justify-between gap-2">
          {title ? <p className={lab.label}>{title}</p> : <span />}
          {action}
        </div>
      ) : null}
      <nav className="flex flex-col gap-1">{children}</nav>
    </aside>
  );
}

/** Item daftar dokumen (padanan BrandHubSidebarItem — mendukung onClick & meta). */
export function LabDocumentSidebarItem({
  active,
  onClick,
  href,
  title,
  meta,
  badge,
}: {
  active?: boolean;
  onClick?: () => void;
  href?: string;
  title: string;
  meta?: string;
  badge?: ReactNode;
}) {
  const className = cn(
    "flex w-full flex-col gap-0.5 rounded-xl border-l-2 border-l-transparent px-3 py-2.5 text-left text-xs transition-colors duration-200 ease-out motion-reduce:transition-none",
    active
      ? "border-l-[var(--lab-accent,var(--primary))] bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_12%,transparent)] text-foreground"
      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
  );

  const content = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{title}</span>
        {badge}
      </span>
      {meta ? (
        <span className="text-muted-foreground truncate text-[10px]">
          {meta}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

export function LabSidebarItem({
  active,
  href,
  title,
  icon: Icon,
  badge,
}: {
  active?: boolean;
  href: string;
  title: string;
  icon?: LucideIcon;
  badge?: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border-l-2 border-l-transparent px-3 py-2 text-left text-xs transition-colors duration-200 ease-out motion-reduce:transition-none",
        active
          ? "border-l-[var(--lab-accent,var(--primary))] bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_12%,transparent)] text-[var(--lab-accent,var(--primary))]"
          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
      )}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
      {badge}
    </Link>
  );
}
