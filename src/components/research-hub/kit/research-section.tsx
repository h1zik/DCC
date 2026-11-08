"use client";

import { useId } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Seksi halaman detail Research Hub: judul `rh-section-title`, satu kalimat
 * `rh-meta` opsional, aksi (tombol) atau `aside` (info kecil, mis. jumlah) di
 * kanan, lalu isi.
 */
export function ResearchSection({
  id,
  title,
  description,
  action,
  aside,
  children,
  className,
}: {
  /** Opsional — dipakai sebagai id judul untuk `aria-labelledby`. */
  id?: string;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const autoId = useId();
  const headingId = id ? `${id}-title` : autoId;
  return (
    <section aria-labelledby={headingId} className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-0.5">
          <h2 id={headingId} className="rh-section-title">
            {title}
          </h2>
          {description ? <p className="rh-meta">{description}</p> : null}
        </div>
        {aside ? <p className="rh-meta rh-num shrink-0">{aside}</p> : null}
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export type ResearchFact = {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
};

/**
 * Daftar metrik tenang (`<dl>`) pengganti tile bento: label 12px, angka
 * tabular 18px, keterangan opsional. Kolom menyesuaikan lebar.
 */
export function ResearchFacts({
  facts,
  className,
}: {
  facts: ResearchFact[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]",
        className,
      )}
    >
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

/**
 * Catatan "sedang berjalan" di halaman detail: apa yang sedang dikerjakan,
 * dengan bar tak-tentu (bukan persen palsu). Diumumkan ke pembaca layar.
 */
export function ResearchRunningNote({
  title,
  description,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "border-border bg-muted/30 flex flex-col gap-2.5 rounded-xl border px-4 py-3",
        className,
      )}
    >
      <p className="text-foreground flex items-center gap-2 text-sm font-medium">
        <Loader2 className="text-muted-foreground size-4 shrink-0 motion-safe:animate-spin" aria-hidden />
        {title}
      </p>
      <div className="rh-ledger-bar" aria-hidden>
        <span className="rh-ledger-seg rh-tone-running" style={{ flexGrow: 1 }} />
      </div>
      {description ? (
        <p className="rh-meta">{description}</p>
      ) : null}
    </div>
  );
}

/** Pesan saat filter tidak menyisakan baris (halaman list). */
export function ResearchFilterEmpty({
  children = "Tidak ada yang cocok dengan filter ini.",
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "rh-meta border-border rounded-xl border border-dashed px-5 py-8 text-center text-[13px]",
        className,
      )}
    >
      {children}
    </p>
  );
}
