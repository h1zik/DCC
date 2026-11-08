import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * State kosong di dalam tab/panel halaman detail — lebih ringan dari
 * LabEmptyState (yang untuk halaman list). Kalimat menjelaskan kenapa kosong
 * dan apa yang bisa dilakukan, bukan sekadar "Tidak ada data".
 */
export function ResearchPanelEmpty({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border/70 flex flex-col items-start gap-3 rounded-xl border border-dashed px-5 py-6 sm:flex-row sm:items-center",
        className,
      )}
    >
      {Icon ? (
        <Icon className="text-muted-foreground size-5 shrink-0" aria-hidden />
      ) : null}
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-foreground text-sm font-medium">{title}</p>
        {description ? <p className="rh-meta text-[13px]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function HeaderSkeleton({ detail = false }: { detail?: boolean }) {
  return (
    <div className="flex flex-col gap-3 pb-5">
      <Skeleton className={cn("h-4", detail ? "w-36" : "w-28")} />
      <Skeleton className={cn("h-8", detail ? "w-80 max-w-full" : "w-64 max-w-full")} />
      <Skeleton className="h-4 w-full max-w-xl" />
    </div>
  );
}

/** Skeleton halaman list modul: header, ledger, filter, tabel. */
export function ResearchListSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6" aria-busy="true" aria-label="Memuat halaman">
      <HeaderSkeleton />
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-56" />
      </div>
      <div className="border-border overflow-hidden rounded-xl border">
        <Skeleton className="h-10 w-full rounded-none" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-border/60 flex items-center gap-4 border-t px-4 py-3">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton halaman detail: header, baris tab, dua panel. */
export function ResearchDetailSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6" aria-busy="true" aria-label="Memuat detail">
      <HeaderSkeleton detail />
      <div className="border-border flex gap-5 border-b pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-20" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}
