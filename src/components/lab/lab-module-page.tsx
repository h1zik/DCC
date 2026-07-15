import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LabPageShell, lab } from "@/components/lab/lab-primitives";
import { cn } from "@/lib/utils";

/**
 * Wrapper halaman modul Lab — gaya "Bento Studio": header display tebal,
 * kapsul ikon tinted, eyebrow nama modul. Dipakai lintas modul (SEO,
 * Research Hub, Brand Hub, Content Studio) via wrapper tipis per modul.
 */
export function LabModulePage({
  icon: Icon,
  eyebrow,
  title,
  description,
  right,
  footer,
  children,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description?: string;
  right?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <LabPageShell className="gap-6">
      <header
        className={cn(
          lab.entrance,
          "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        )}
      >
        <div className="flex min-w-0 items-start gap-3.5">
          <span
            className="bg-primary/12 text-primary flex size-11 shrink-0 items-center justify-center rounded-2xl"
            aria-hidden
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className={lab.label}>{eyebrow}</p>
            <h1 className="text-foreground mt-0.5 text-2xl font-extrabold tracking-tight sm:text-[1.65rem]">
              {title}
            </h1>
            {description ? (
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
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
      </header>
      {footer}
      {children}
    </LabPageShell>
  );
}

/** Wrapper halaman detail Lab — varian bento dengan link kembali. */
export function LabDetailPage({
  icon: Icon,
  eyebrow,
  title,
  description,
  right,
  backHref,
  children,
}: {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  right?: ReactNode;
  backHref?: string;
  children: ReactNode;
}) {
  return (
    <LabPageShell className="gap-6">
      <header
        className={cn(
          lab.entrance,
          "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        )}
      >
        <div className="flex min-w-0 items-start gap-3.5">
          {Icon ? (
            <span
              className="bg-primary/12 text-primary flex size-11 shrink-0 items-center justify-center rounded-2xl"
              aria-hidden
            >
              <Icon className="size-5" />
            </span>
          ) : null}
          <div className="min-w-0">
            {backHref ? (
              <Link
                href={backHref}
                className="text-muted-foreground hover:text-foreground mb-1 inline-flex items-center gap-1.5 text-xs font-semibold transition-colors"
              >
                <ArrowLeft className="size-3.5" />
                Kembali
              </Link>
            ) : eyebrow ? (
              <p className={lab.label}>{eyebrow}</p>
            ) : null}
            <h1 className="text-foreground mt-0.5 truncate text-xl font-extrabold tracking-tight sm:text-2xl">
              {title}
            </h1>
            {description ? (
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
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
      </header>
      {children}
    </LabPageShell>
  );
}
