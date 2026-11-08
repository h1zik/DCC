import { cn } from "@/lib/utils";

/**
 * Seksi halaman detail Competitor Tracker: judul `rh-section-title`, satu
 * kalimat `rh-meta` opsional, aksi di kanan.
 */
export function DetailSection({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  /** Dipakai untuk `aria-labelledby`. */
  id: string;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const titleId = `${id}-title`;
  return (
    <section aria-labelledby={titleId} className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-0.5">
          <h2 id={titleId} className="rh-section-title">
            {title}
          </h2>
          {description ? <p className="rh-meta">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export type Fact = {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
};

/** Daftar definisi metrik yang tenang — pengganti tile bento. */
export function FactList({ facts, className }: { facts: Fact[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-6", className)}>
      {facts.map((f) => (
        <div key={f.label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="rh-meta">{f.label}</dt>
          <dd className="rh-num text-foreground truncate text-lg font-semibold tracking-tight">
            {f.value}
          </dd>
          {f.hint ? <dd className="rh-meta rh-num">{f.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
