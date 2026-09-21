"use client";

import { useMemo, useState, useTransition } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getFinanceMonthlyReportPdf } from "@/actions/finance-monthly-report";
import { actionErrorMessage } from "@/lib/action-error-message";
import { downloadPdfFromBase64 } from "@/lib/download-file-client";
import { periodLabel } from "@/lib/finance-period";
import {
  monthIndex,
  recentMonths,
  type YearMonth,
} from "@/lib/finance-monthly-report/period";
import type { SelectItemDef } from "@/lib/select-option-items";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const MONTH_OPTIONS = 24;
const ALL_BRANDS = "__all__";

const REPORT_CONTENTS = [
  "Ringkasan eksekutif & sorotan otomatis",
  "Laba rugi, neraca, dan arus kas (vs bulan lalu)",
  "Laba rugi per brand, anggaran vs realisasi",
  "Umur piutang & hutang, rekap pajak",
  "Lembar pengesahan & lampiran neraca saldo",
];

const keyOf = (p: YearMonth) => `${p.year}-${String(p.month).padStart(2, "0")}`;

export function MonthlyReportButton({
  brands,
  currentMonth,
  defaultMonth,
  defaultBrandId = null,
  variant = "default",
}: {
  brands: { id: string; name: string }[];
  /** Bulan berjalan (kalender Jakarta) — dihitung server agar tidak mismatch hidrasi. */
  currentMonth: YearMonth;
  defaultMonth: YearMonth;
  defaultBrandId?: string | null;
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [monthKey, setMonthKey] = useState(keyOf(defaultMonth));
  const [brandId, setBrandId] = useState(
    defaultBrandId && brands.some((b) => b.id === defaultBrandId)
      ? defaultBrandId
      : ALL_BRANDS,
  );

  const months = useMemo(() => {
    const list = recentMonths(currentMonth, MONTH_OPTIONS);
    // Bulan yang sedang dilihat bisa lebih lama dari 24 bulan terakhir.
    if (!list.some((m) => monthIndex(m) === monthIndex(defaultMonth)))
      list.push(defaultMonth);
    return list;
  }, [currentMonth, defaultMonth]);

  const monthItems: SelectItemDef[] = months.map((m) => ({
    value: keyOf(m),
    label: periodLabel(m.year, m.month),
  }));
  const brandItems: SelectItemDef[] = [
    { value: ALL_BRANDS, label: "Semua brand" },
    ...brands.map((b) => ({ value: b.id, label: b.name })),
  ];

  const selected = months.find((m) => keyOf(m) === monthKey) ?? defaultMonth;
  const isRunningMonth = monthIndex(selected) === monthIndex(currentMonth);
  const brandLabel =
    brandId === ALL_BRANDS
      ? "Semua brand"
      : (brands.find((b) => b.id === brandId)?.name ?? "Semua brand");

  function handleDownload() {
    startTransition(async () => {
      try {
        const { base64, fileName } = await getFinanceMonthlyReportPdf({
          year: selected.year,
          month: selected.month,
          brandId: brandId === ALL_BRANDS ? null : brandId,
        });
        downloadPdfFromBase64(base64, fileName);
        toast.success("Laporan keuangan berhasil diunduh.");
        setOpen(false);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat laporan keuangan."));
      }
    });
  }

  return (
    <Dialog
      open={open}
      // Jangan tutup saat PDF masih disusun — hasil unduhan akan hilang konteks.
      onOpenChange={(next) => {
        if (!pending) setOpen(next);
      }}
    >
      <DialogTrigger
        render={<Button type="button" size="sm" variant={variant} />}
      >
        <FileDown className="size-3.5" /> Laporan Bulanan (PDF)
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Laporan keuangan bulanan</DialogTitle>
          <DialogDescription>
            Dokumen PDF A4 siap presentasi, disusun dari jurnal terposting.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Periode</Label>
            <Select
              value={monthKey}
              items={monthItems}
              onValueChange={(v) => v && setMonthKey(v)}
              disabled={pending}
            >
              <SelectTrigger className="w-full">
                <span>{periodLabel(selected.year, selected.month)}</span>
              </SelectTrigger>
              <SelectContent>
                {monthItems.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Cakupan</Label>
            <Select
              value={brandId}
              items={brandItems}
              onValueChange={(v) => setBrandId(v || ALL_BRANDS)}
              disabled={pending}
            >
              <SelectTrigger className="w-full">
                <span className="line-clamp-1">{brandLabel}</span>
              </SelectTrigger>
              <SelectContent>
                {brandItems.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wide uppercase">
            Isi laporan
          </p>
          <ul className="text-muted-foreground list-disc space-y-0.5 pl-4 text-xs">
            {REPORT_CONTENTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        {isRunningMonth ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            Bulan ini masih berjalan — laporan memuat data s.d. hari ini dan
            ditandai DRAFT sampai periode dikunci.
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" onClick={handleDownload} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Menyusun laporan…
              </>
            ) : (
              <>
                <FileDown className="size-3.5" /> Unduh PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
