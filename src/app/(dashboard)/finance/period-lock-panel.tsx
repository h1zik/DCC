"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import {
  lockFinancePeriod,
  unlockFinancePeriod,
} from "@/actions/finance-period-lock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { FinanceSectionCard } from "@/components/finance/section-card";
import { FINANCE_MONTH_LABELS, periodLabel } from "@/lib/finance-period";
import { formatDateId } from "@/lib/finance-format";

type Lock = {
  id: string;
  year: number;
  month: number;
  lockedAtIso: string;
  lockedByName: string | null;
  reason: string | null;
};

type Props = {
  currentPeriod: { year: number; month: number };
  locks: Lock[];
};

export function PeriodLockPanel({ currentPeriod, locks }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [year, setYear] = useState(currentPeriod.year);
  const [month, setMonth] = useState(currentPeriod.month);
  const [reason, setReason] = useState("");

  function lock() {
    startTransition(async () => {
      try {
        await lockFinancePeriod({ year, month, reason: reason || null });
        toast.success(`Periode ${periodLabel(year, month)} dikunci.`);
        setReason("");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal mengunci periode.");
      }
    });
  }

  function unlock(y: number, m: number) {
    if (!window.confirm(`Buka kunci periode ${periodLabel(y, m)}?`)) return;
    startTransition(async () => {
      try {
        await unlockFinancePeriod({ year: y, month: m });
        toast.success(`Periode ${periodLabel(y, m)} dibuka.`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal membuka periode.");
      }
    });
  }

  return (
    <FinanceSectionCard
      title="Tutup buku (period locking)"
      accent="amber"
      description="Periode yang dikunci tidak dapat menerima jurnal baru, edit, atau pembalikan — best practice untuk audit trail."
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="border-border/60 flex flex-col gap-3 rounded-lg border p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="lock-year" className="text-xs">
                Tahun
              </Label>
              <Input
                id="lock-year"
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Bulan</Label>
              <Select
                value={String(month)}
                onValueChange={(v) => setMonth(Number(v))}
              >
                <SelectTrigger className="h-8 w-full text-sm">
                  <span>{FINANCE_MONTH_LABELS[month - 1]}</span>
                </SelectTrigger>
                <SelectContent>
                  {FINANCE_MONTH_LABELS.map((label, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lock-reason" className="text-xs">
              Alasan / catatan (opsional)
            </Label>
            <Input
              id="lock-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="mis. Tutup buku bulanan setelah rekonsiliasi"
              className="h-8 text-sm"
            />
          </div>
          <Button type="button" size="sm" disabled={pending} onClick={lock}>
            <Lock className="size-3.5" /> Kunci periode {periodLabel(year, month)}
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {locks.length === 0 ? (
            <p className="border-border/60 text-muted-foreground rounded-lg border border-dashed py-6 text-center text-xs">
              Belum ada periode terkunci.
            </p>
          ) : (
            <ul className="border-border/60 divide-border/60 max-h-[260px] divide-y overflow-auto rounded-lg border">
              {locks.map((l) => (
                <li
                  key={l.id}
                  className="hover:bg-muted/30 flex items-start justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold tracking-tight">
                      <Lock className="-mt-0.5 mr-1 inline size-3 text-amber-500" />
                      {periodLabel(l.year, l.month)}
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      Dikunci {formatDateId(new Date(l.lockedAtIso))} · oleh{" "}
                      {l.lockedByName ?? "—"}
                    </p>
                    {l.reason ? (
                      <p className="text-muted-foreground line-clamp-1 text-[11px] italic">
                        “{l.reason}”
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px]"
                    disabled={pending}
                    onClick={() => unlock(l.year, l.month)}
                    aria-label={`Buka kunci ${periodLabel(l.year, l.month)}`}
                  >
                    <LockOpen className="size-3" /> Buka
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </FinanceSectionCard>
  );
}
