import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  ResearchBackLink,
  ResearchModelLine,
  ResearchStepLocator,
} from "@/components/research-hub/kit/research-locator";
import { cn } from "@/lib/utils";

/**
 * Header halaman Research Hub ("meja riset"): penanda tahap alur riset di
 * atas judul, judul tanpa kapsul ikon, keterangan model AI satu baris, dan
 * slot `summary` (mis. RunLedger) langsung di bawah garis header.
 *
 * `icon` tetap diterima demi kompatibilitas pemanggil lama; ikon modul sudah
 * tampil di navigasi sehingga tidak diulang di header.
 */
export function ResearchHubModulePage({
  title,
  description,
  right,
  summary,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  right?: ReactNode;
  /** Ringkasan status di bawah header (RunLedger). */
  summary?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-6 pb-12">
      <header className="border-border flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <ResearchStepLocator />
          <h1 className="rh-title">{title}</h1>
          {description ? <p className="rh-lede">{description}</p> : null}
          <ResearchModelLine />
        </div>
        {right ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div>
        ) : null}
      </header>
      {summary}
      {children}
    </div>
  );
}

/** Header halaman detail: link kembali bernama modul, judul, aksi. */
export function ResearchHubDetailPage({
  title,
  description,
  right,
  backHref,
  backLabel,
  meta,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  right?: ReactNode;
  backHref?: string;
  /** Default: nama modul dari navigasi. */
  backLabel?: string;
  /** Baris info kecil di bawah judul (status, waktu update, sumber). */
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-6 pb-12">
      <header className="border-border flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <ResearchBackLink href={backHref} label={backLabel} className="self-start" />
          <h1 className={cn("rh-title-detail break-words")}>{title}</h1>
          {description ? <p className="rh-lede">{description}</p> : null}
          {meta ? <div className="rh-meta flex flex-wrap items-center gap-x-4 gap-y-1">{meta}</div> : null}
        </div>
        {right ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div>
        ) : null}
      </header>
      {children}
    </div>
  );
}
