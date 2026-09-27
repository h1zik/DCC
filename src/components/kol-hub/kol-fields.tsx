"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRupiahInput, parseRupiahInput } from "@/lib/kol/format";
import { cn } from "@/lib/utils";

export type Opt = { value: string; label: ReactNode };

const NONE = "__none";

/**
 * Select Base UI dengan opsi kosong. `value` "" = belum dipilih; sentinel
 * internal dipakai karena Base UI butuh nilai string untuk tiap item.
 */
export function KolSelect({
  value,
  onChange,
  options,
  placeholder = "Pilih…",
  emptyLabel,
  className,
  disabled,
  id,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Opt[];
  placeholder?: string;
  /** Bila diisi, muncul opsi untuk mengosongkan pilihan. */
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
}) {
  const items: Opt[] = [
    ...(emptyLabel ? [{ value: NONE, label: emptyLabel }] : []),
    ...options,
  ];
  const current = value ? value : emptyLabel ? NONE : null;
  return (
    <Select
      value={current}
      items={items}
      disabled={disabled}
      onValueChange={(v) => onChange(!v || v === NONE ? "" : String(v))}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Input nominal rupiah — menampilkan titik ribuan, menyimpan angka mentah. */
export function RupiahInput({
  value,
  onChange,
  id,
  placeholder = "0",
  disabled,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (raw: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs">
        Rp
      </span>
      <Input
        id={id}
        inputMode="numeric"
        aria-label={ariaLabel}
        placeholder={placeholder}
        disabled={disabled}
        value={formatRupiahInput(value)}
        onChange={(e) => onChange(parseRupiahInput(e.target.value))}
        className="pl-8 tabular-nums"
      />
    </div>
  );
}

/** Label + kontrol + petunjuk/galat — satu blok field form. */
export function Field({
  label,
  htmlFor,
  hint,
  optional,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
        {optional ? (
          <span className="text-muted-foreground font-normal"> (opsional)</span>
        ) : null}
      </Label>
      {children}
      {hint ? <p className="text-muted-foreground text-[11px] leading-relaxed">{hint}</p> : null}
    </div>
  );
}
