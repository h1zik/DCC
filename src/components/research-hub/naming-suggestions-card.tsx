"use client";

import { Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NamingSuggestionsCard({
  suggestions,
}: {
  suggestions: string[];
}) {
  if (suggestions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Tag className="size-4" aria-hidden />
          Naming Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {suggestions.map((name, i) => (
          <div
            key={name}
            className="bg-muted/50 flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
          >
            <span className="bg-primary/15 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
              {i + 1}
            </span>
            {name}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
