import { Download } from "lucide-react";

export type FinanceExportItem = {
  /** Nilai parameter `report` pada /api/finance/export. */
  report: string;
  label: string;
};

type Props = {
  items: FinanceExportItem[];
  /** yyyy-mm-dd. Laporan posisi memakai `to` sebagai tanggal cut-off. */
  from: string;
  to: string;
  brandId?: string | null;
  accountId?: string | null;
};

/**
 * Menu unduh CSV. Sengaja tautan biasa di dalam `<details>` (tanpa JS klien):
 * unduhan ditangani browser lewat Content-Disposition dari route ekspor.
 */
export function FinanceExportMenu({ items, from, to, brandId, accountId }: Props) {
  const href = (report: string) => {
    const q = new URLSearchParams({ report, from, to });
    if (brandId) q.set("brandId", brandId);
    if (accountId) q.set("accountId", accountId);
    return `/api/finance/export?${q.toString()}`;
  };

  return (
    <details className="relative">
      <summary className="border-border bg-background hover:bg-muted inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md border px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <Download className="size-3.5" aria-hidden />
        Ekspor CSV
      </summary>
      <div className="border-border bg-popover text-popover-foreground absolute right-0 z-20 mt-1 flex min-w-56 flex-col rounded-md border p-1 shadow-md">
        {items.map((it) => (
          <a
            key={it.report}
            href={href(it.report)}
            download
            className="hover:bg-muted rounded px-2.5 py-1.5 text-sm"
          >
            {it.label}
          </a>
        ))}
        <p className="text-muted-foreground border-border mt-1 border-t px-2.5 pt-1.5 pb-1 text-[11px]">
          Periode {from} s.d. {to}
        </p>
      </div>
    </details>
  );
}
