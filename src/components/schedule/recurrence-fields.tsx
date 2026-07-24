"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SelectItemDef } from "@/lib/select-option-items";
import { APPLY_TO_ITEMS, type ScheduleRecurrenceValue } from "./schedule-types";

/** "Terapkan ke" untuk edit acara berseri + catatan perbedaan SINGLE/SERIES. */
export function ApplyToField({
  value,
  onChange,
  disabled,
}: {
  value: "SINGLE" | "SERIES";
  onChange: (value: "SINGLE" | "SERIES") => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="sch-apply">Terapkan ke</Label>
      <Select
        value={value}
        items={APPLY_TO_ITEMS}
        onValueChange={(v) => onChange(v as "SINGLE" | "SERIES")}
        disabled={disabled}
      >
        <SelectTrigger id="sch-apply" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {APPLY_TO_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="rounded-md border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
        <span className="text-foreground font-medium">Acara ini saja</span>{" "}
        mengubah satu kejadian ini;{" "}
        <span className="text-foreground font-medium">Seluruh seri</span>{" "}
        menerapkan perubahan (termasuk aturan pengulangan) ke semua kejadian
        dalam seri.
      </p>
    </div>
  );
}

/** Select pengulangan (dipakai di dalam grid dua kolom form). */
export function RecurrenceField({
  items,
  value,
  onChange,
  disabled,
}: {
  items: SelectItemDef[];
  value: ScheduleRecurrenceValue;
  onChange: (value: ScheduleRecurrenceValue) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="sch-recur">Pengulangan</Label>
      <Select
        value={value}
        items={items}
        onValueChange={(v) => onChange(v as ScheduleRecurrenceValue)}
        disabled={disabled}
      >
        <SelectTrigger id="sch-recur" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Tanggal akhir pengulangan + helper 120 kejadian. */
export function RecurrenceUntilField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="sch-recur-until">Ulangi sampai tanggal</Label>
      <Input
        id="sch-recur-until"
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      <p className="text-muted-foreground text-xs">
        Event akan dibuat otomatis sampai tanggal ini (maksimal 120 kejadian).
      </p>
    </div>
  );
}
