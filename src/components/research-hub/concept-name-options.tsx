"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function ConceptNameOptions({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected?: string;
  onSelect: (name: string) => void;
}) {
  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((name) => {
        const isSelected = selected === name;
        return (
          <button
            key={name}
            type="button"
            onClick={() => onSelect(name)}
            aria-pressed={isSelected}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors motion-reduce:transition-none",
              isSelected
                ? "border-transparent bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_15%,transparent)] font-semibold text-[var(--lab-accent,var(--primary))]"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground font-medium",
            )}
          >
            {isSelected ? <Check className="size-3.5" aria-hidden /> : null}
            {name}
          </button>
        );
      })}
    </div>
  );
}
