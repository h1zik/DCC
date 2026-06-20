"use client";

import { Tag } from "lucide-react";
import { hub } from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";

export function NamingSuggestionsCard({
  suggestions,
  bare = false,
}: {
  suggestions: string[];
  bare?: boolean;
}) {
  if (suggestions.length === 0) return null;

  const list = (
    <div className="space-y-2">
      {suggestions.map((name, i) => (
        <div
          key={name}
          className={cn(
            hub.nestedPanel,
            "flex items-center gap-2 text-sm",
          )}
        >
          <span className="bg-primary/15 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
            {i + 1}
          </span>
          {name}
        </div>
      ))}
    </div>
  );

  if (bare) return list;

  return (
    <div className={hub.panel}>
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Tag className="size-4" aria-hidden />
        Naming Intelligence
      </p>
      {list}
    </div>
  );
}
