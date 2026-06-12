"use client";

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
      {options.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onSelect(name)}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm transition-colors",
            selected === name
              ? "border-primary bg-primary/10 text-primary font-medium"
              : "border-border hover:bg-muted",
          )}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
