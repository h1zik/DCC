"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { periodLabel } from "@/lib/finance-period";

export function PeriodSelector({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function goto(next: { year: number; month: number }) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    params.set("period", `${next.year}-${String(next.month).padStart(2, "0")}`);
    startTransition(() => {
      router.replace(`/finance?${params.toString()}`, { scroll: false });
    });
  }

  function shift(delta: number) {
    const idx = year * 12 + (month - 1) + delta;
    const ny = Math.floor(idx / 12);
    const nm = (idx % 12) + 1;
    goto({ year: ny, month: nm });
  }

  function gotoCurrent() {
    const now = new Date();
    goto({ year: now.getFullYear(), month: now.getMonth() + 1 });
  }

  const now = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="border-border bg-card text-foreground inline-flex items-center gap-1 rounded-lg border p-1 shadow-sm">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Periode sebelumnya"
        onClick={() => shift(-1)}
        disabled={pending}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="text-foreground inline-flex items-center gap-1.5 px-2 text-sm font-medium tabular-nums">
        <CalendarDays className="text-muted-foreground size-3.5" aria-hidden />
        {periodLabel(year, month)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Periode berikutnya"
        onClick={() => shift(1)}
        disabled={pending}
      >
        <ChevronRight className="size-4" />
      </Button>
      {!isCurrent ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={gotoCurrent}
          disabled={pending}
        >
          Hari ini
        </Button>
      ) : null}
    </div>
  );
}
