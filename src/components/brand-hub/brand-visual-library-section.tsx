import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function BrandVisualLibrarySection({
  title,
  description,
  action,
  emptyHint,
  emptyHref,
  isEmpty,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  emptyHint?: string;
  emptyHref?: string;
  isEmpty?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 gap-2">{action}</div> : null}
      </div>

      {isEmpty ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center">
          <p className="text-muted-foreground text-xs">
            {emptyHint ?? "Belum ada visual di section ini."}
          </p>
          {emptyHref ? (
            <Link
              href={emptyHref}
              className="text-primary mt-2 inline-block text-xs font-medium hover:underline"
            >
              Buka modul sumber
            </Link>
          ) : null}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

export function VisualLibrarySubGroup({
  title,
  href,
  count,
  children,
}: {
  title: string;
  href?: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {href ? (
          <Link href={href} className="text-sm font-medium hover:underline">
            {title}
          </Link>
        ) : (
          <span className="text-sm font-medium">{title}</span>
        )}
        <span className="text-muted-foreground text-xs">{count} visual</span>
      </div>
      {children}
    </div>
  );
}
