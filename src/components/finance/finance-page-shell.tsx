import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Crumb = { label: string; href?: string };

type Props = {
  /** Breadcrumb di atas judul (mis. [{label:"Keuangan", href:"/finance"}, {label:"Jurnal"}]). */
  breadcrumbs?: Crumb[];
  /** Ikon di samping judul. */
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  /** Aksi cepat di sisi kanan header. */
  actions?: React.ReactNode;
  /** Lebar konten maks. */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  children: React.ReactNode;
};

const MAX_WIDTH: Record<NonNullable<Props["maxWidth"]>, string> = {
  sm: "max-w-3xl",
  md: "max-w-4xl",
  lg: "max-w-5xl",
  xl: "max-w-6xl",
  "2xl": "max-w-[1400px]",
  full: "max-w-none",
};

/**
 * Shell halaman modul keuangan: breadcrumb + judul/aksi + konten.
 * Dipakai oleh semua sub-halaman finance untuk tampilan konsisten.
 */
export function FinancePageShell({
  breadcrumbs,
  icon,
  title,
  description,
  actions,
  maxWidth = "lg",
  children,
}: Props) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-6 pb-10",
        MAX_WIDTH[maxWidth],
      )}
    >
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav
          aria-label="Breadcrumb"
          className="text-muted-foreground -mb-2 flex flex-wrap items-center gap-1 text-xs"
        >
          {breadcrumbs.map((c, i) => (
            <span key={`${c.label}-${i}`} className="inline-flex items-center gap-1">
              {i > 0 ? (
                <ChevronRight className="text-muted-foreground/60 size-3" aria-hidden />
              ) : null}
              {c.href ? (
                <Link
                  href={c.href}
                  className="hover:text-foreground transition-colors"
                >
                  {c.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}

      <header className="border-border/60 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          {icon ? (
            <span
              aria-hidden
              className="border-primary/30 bg-primary/10 text-primary mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border"
            >
              {icon}
            </span>
          ) : null}
          <div className="space-y-1">
            <h1 className="text-foreground text-xl font-semibold tracking-tight sm:text-2xl">
              {title}
            </h1>
            {description ? (
              <p className="text-muted-foreground text-sm leading-relaxed">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </header>

      {children}
    </div>
  );
}
