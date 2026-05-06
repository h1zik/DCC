"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CogsCalculator() {
  const [hpp, setHpp] = useState("");
  const [price, setPrice] = useState("");

  const result = useMemo(() => {
    const h = Number(hpp.replace(/\./g, "").replace(",", "."));
    const p = Number(price.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(h) || !Number.isFinite(p) || p <= 0) return null;
    const margin = ((p - h) / p) * 100;
    const profit = p - h;
    return { margin, profit };
  }, [hpp, price]);

  return (
    <div className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>HPP / COGS per unit</Label>
        <Input value={hpp} onChange={(e) => setHpp(e.target.value)} placeholder="125000" />
      </div>
      <div className="space-y-2">
        <Label>Harga jual</Label>
        <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="199000" />
      </div>
      {result ? (
        <div className="text-muted-foreground text-sm sm:col-span-2">
          Margin bruto:{" "}
          <span className="text-foreground font-semibold tabular-nums">
            {result.margin.toFixed(1)}%
          </span>
          {" · "}
          Kontribusi per unit:{" "}
          <span className="text-foreground font-semibold tabular-nums">
            {formatIdr(result.profit)}
          </span>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs sm:col-span-2">
          Masukkan angka valid untuk melihat margin dan kontribusi per unit.
        </p>
      )}
    </div>
  );
}

function formatIdr(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}
