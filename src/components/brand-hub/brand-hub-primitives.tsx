import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared layout + surface styles for Brand & Creative Hub. */
export const hub = {
  page: "flex w-full flex-col gap-8 pb-10",
  section: "flex flex-col gap-4",
  sectionTitle: "text-base font-semibold tracking-tight text-foreground",
  sectionDesc: "text-muted-foreground text-sm leading-relaxed",
  card:
    "relative overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm",
  cardHover:
    "transition-all duration-300 hover:border-border hover:shadow-md hover:-translate-y-0.5",
  cardBody: "p-5 sm:p-6",
  panel:
    "rounded-2xl border border-border/50 bg-card/80 p-5 shadow-sm backdrop-blur-sm",
  nestedPanel: "rounded-xl border border-border/40 bg-muted/20 p-4",
  label:
    "text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]",
  stickyToolbar:
    "border-border/70 bg-card/80 sticky top-0 z-20 -mt-2 border-b backdrop-blur supports-backdrop-filter:bg-card/60",
} as const;

export function BrandHubPageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(hub.page, className)}>{children}</div>;
}

export function BrandHubPageHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  right,
  footer,
  variant = "default",
  className,
}: {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  right?: ReactNode;
  footer?: ReactNode;
  variant?: "default" | "compact" | "detail";
  className?: string;
}) {
  const isCompact = variant === "compact";
  const isDetail = variant === "detail";

  return (
    <header
      className={cn(
        hub.card,
        "isolate",
        isDetail ? "border-primary/20 bg-gradient-to-br from-card via-card to-primary/5" : "",
        className,
      )}
    >
      {!isDetail ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_-20%,var(--primary)/0.12,transparent)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
            aria-hidden
          />
        </>
      ) : null}

      <div
        className={cn(
          "relative flex flex-col gap-4",
          isCompact ? "p-4 sm:p-5" : "p-5 sm:p-7",
          right ? "sm:flex-row sm:items-end sm:justify-between" : "",
        )}
      >
        <div className="flex min-w-0 items-start gap-4">
          {Icon ? (
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-inner",
                isCompact ? "size-10" : "size-12",
              )}
              aria-hidden
            >
              <Icon className={isCompact ? "size-5" : "size-6"} />
            </span>
          ) : null}
          <div className="min-w-0 space-y-2">
            {eyebrow ? <p className={hub.label}>{eyebrow}</p> : null}
            <h1
              className={cn(
                "text-foreground font-semibold tracking-tight text-balance",
                isCompact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl",
              )}
            >
              {title}
            </h1>
            {description ? (
              <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed sm:text-[15px]">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {right ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div>
        ) : null}
      </div>
      {footer ? (
        <div className="border-border/50 relative border-t px-5 py-3 sm:px-7">
          {footer}
        </div>
      ) : null}
    </header>
  );
}

export function BrandHubSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(hub.section, className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={hub.sectionTitle}>{title}</h2>
          {description ? <p className={hub.sectionDesc}>{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function BrandHubEmptyState({
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
        "flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/15 px-8 py-14 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-2xl">
          <Icon className="size-6" />
        </span>
      ) : null}
      <div className="max-w-md space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description ? (
          <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function BrandHubStatChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "success" | "warning" | "primary";
}) {
  const tones = {
    neutral: "bg-muted/60 text-foreground",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    warning: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
    primary: "bg-primary/10 text-primary",
  };
  return (
    <div
      className={cn(
        "inline-flex flex-col gap-0.5 rounded-xl border border-border/40 px-3 py-2",
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

export function BrandHubDocumentSidebar({
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
          {title ? <p className={hub.label}>{title}</p> : <span />}
          {action}
        </div>
      ) : null}
      <nav className="flex flex-col gap-1">{children}</nav>
    </aside>
  );
}

export function BrandHubSidebarItem({
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
    "flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left text-xs transition-colors",
    active
      ? "bg-foreground text-background shadow-sm"
      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
  );

  const content = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{title}</span>
        {badge}
      </span>
      {meta ? (
        <span
          className={cn(
            "truncate text-[10px]",
            active ? "text-background/70" : "text-muted-foreground",
          )}
        >
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
