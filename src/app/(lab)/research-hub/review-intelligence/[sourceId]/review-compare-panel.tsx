"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { CrossCompareChart } from "@/components/research-hub/cross-compare-chart";
import { DetailSection } from "./review-overview";

export type CompareOption = {
  id: string;
  productName: string;
  competitorBrand: string;
  positivePct: number;
  neutralPct: number;
  negativePct: number;
};

const MAX_COMPARE = 4;

/** Tab "Bandingkan": distribusi sentimen produk ini vs maks. 4 sumber lain. */
export function ReviewComparePanel({
  productName,
  sentiment,
  options,
}: {
  productName: string;
  sentiment: { positive: number; neutral: number; negative: number };
  options: CompareOption[];
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const chartData = useMemo(() => {
    const rows = [{ label: productName.slice(0, 20), ...sentiment }];
    for (const id of selected) {
      const opt = options.find((o) => o.id === id);
      if (!opt) continue;
      rows.push({
        label: opt.productName.slice(0, 20),
        positive: opt.positivePct,
        neutral: opt.neutralPct,
        negative: opt.negativePct,
      });
    }
    return rows;
  }, [productName, sentiment, selected, options]);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) {
        toast.error(`Maksimal ${MAX_COMPARE} produk pembanding. Hapus satu dulu.`);
        return prev;
      }
      return [...prev, id];
    });
  }

  return (
    <DetailSection
      id="rd-compare"
      title="Bandingkan antar produk"
      description={`Pilih sampai ${MAX_COMPARE} produk lain untuk membandingkan distribusi sentimen.`}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Produk pembanding</legend>
        {options.map((opt) => (
          <label
            key={opt.id}
            className="bg-muted/40 hover:bg-muted/70 flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors duration-150 motion-reduce:transition-none"
          >
            <Checkbox
              checked={selected.includes(opt.id)}
              onCheckedChange={() => toggle(opt.id)}
            />
            <span className="min-w-0 truncate">
              {opt.productName}{" "}
              <span className="text-muted-foreground">({opt.competitorBrand})</span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="rh-meta" aria-live="polite">
        {selected.length} dari {MAX_COMPARE} pembanding dipilih
      </p>
      <CrossCompareChart data={chartData} />
    </DetailSection>
  );
}
