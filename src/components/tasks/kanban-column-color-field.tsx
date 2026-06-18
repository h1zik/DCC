"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_KANBAN_COLUMN_COLOR,
  KANBAN_COLUMN_COLOR_PRESETS,
} from "@/lib/room-kanban-columns";
import { cn } from "@/lib/utils";

export function KanbanColumnColorField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground text-xs">Warna kolom</Label>
      <div className="flex flex-wrap items-center gap-2">
        {KANBAN_COLUMN_COLOR_PRESETS.map((preset) => {
          const selected = value.toUpperCase() === preset.toUpperCase();
          return (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              title={preset}
              aria-label={`Warna ${preset}`}
              aria-pressed={selected}
              onClick={() => onChange(preset)}
              className={cn(
                "size-7 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-background transition-transform hover:scale-105",
                selected ? "ring-primary" : "ring-transparent",
              )}
              style={{ backgroundColor: preset }}
            />
          );
        })}
        <Input
          type="color"
          value={value || DEFAULT_KANBAN_COLUMN_COLOR}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="size-8 shrink-0 cursor-pointer border-0 p-0.5"
          disabled={disabled}
          title="Pilih warna kustom"
        />
      </div>
    </div>
  );
}
