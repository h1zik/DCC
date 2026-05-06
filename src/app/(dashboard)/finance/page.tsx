import { Landmark } from "lucide-react";
import { FinanceClearDemoButton } from "@/components/finance/finance-clear-demo-button";
import { FinanceModuleGrid } from "@/components/finance/finance-module-grid";

export default function FinanceHomePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-10">
      <div className="flex flex-col gap-2 border-b border-border pb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-primary">
            <Landmark className="size-8 shrink-0" aria-hidden />
            <h1 className="text-2xl font-semibold tracking-tight">
              Sistem keuangan
            </h1>
          </div>
          <FinanceClearDemoButton />
        </div>
        <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
          Modul akuntansi double-entry, treasury, hutang/piutang, anggaran,
          pelaporan, dan aset tetap. Pilih area di bawah untuk mengelola data.
        </p>
        <p className="text-muted-foreground text-xs">
          Tombol <span className="font-medium text-foreground">Bersihkan</span>{" "}
          hanya untuk reset data demo finance.
        </p>
      </div>

      <FinanceModuleGrid />
    </div>
  );
}
