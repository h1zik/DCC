import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Bagian halaman detail: judul `rh-section-title`, satu kalimat `rh-meta`
 * opsional, aksi di kanan, lalu isi. Pengganti panel `bento-tile` berlabel.
 */
export function DetailSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-0.5">
          <h2 id={headingId} className="rh-section-title">
            {title}
          </h2>
          {description ? <p className="rh-meta">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Daftar metrik tenang: `dt` rh-meta, `dd` angka tabular. */
export function MetricList({
  items,
  className,
}: {
  items: { label: string; value: React.ReactNode; hint?: React.ReactNode }[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="rh-meta">{item.label}</dt>
          <dd className="rh-num text-foreground text-lg font-semibold tracking-tight">
            {item.value}
          </dd>
          {item.hint ? <dd className="rh-meta">{item.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
