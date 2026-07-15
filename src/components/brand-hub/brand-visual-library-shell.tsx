"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { ArrowUpRight, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SelectItemDef } from "@/lib/select-option-items";

export type VisualLibrarySourceKey =
  | "pinterest"
  | "competitor"
  | "competitorProduct"
  | "social"
  | "adLibrary"
  | "manual";

export type VisualLibraryEntityItem = {
  id: string;
  name: string;
  count: number;
  subtitle?: string;
  status?: string;
};

export function VisualLibrarySourceTabs({
  sources,
  active,
  onChange,
}: {
  sources: {
    key: VisualLibrarySourceKey;
    label: string;
    count: number;
  }[];
  active: VisualLibrarySourceKey;
  onChange: (key: VisualLibrarySourceKey) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Sumber visual"
      className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {sources.map((s) => {
        const selected = active === s.key;
        return (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(s.key)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors duration-150",
              selected
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {s.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                selected
                  ? "bg-background/20 text-background"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {s.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function VisualLibraryEntityPicker({
  entities,
  activeId,
  onChange,
  className,
}: {
  entities: VisualLibraryEntityItem[];
  activeId: string | null;
  onChange: (id: string) => void;
  className?: string;
}) {
  const entityItems = useMemo<SelectItemDef[]>(
    () =>
      entities.map((e) => ({ value: e.id, label: `${e.name} (${e.count})` })),
    [entities],
  );

  if (entities.length === 0) return null;

  const active = entities.find((e) => e.id === activeId) ?? entities[0];

  return (
    <>
      <div className={cn("md:hidden", className)}>
        <Select
          value={active?.id}
          items={entityItems}
          onValueChange={(v) => {
            if (v) onChange(v);
          }}
        >
          <SelectTrigger className="h-9 w-full text-xs">
            <SelectValue placeholder="Pilih item" />
          </SelectTrigger>
          <SelectContent>
            {entities.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name} ({e.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <aside
        className={cn(
          "hidden w-full shrink-0 flex-col gap-0.5 md:flex md:w-52 lg:w-56",
          className,
        )}
      >
        <p className="text-muted-foreground mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider">
          Daftar
        </p>
        <nav
          aria-label="Pilih entitas"
          className="flex max-h-[min(420px,50vh)] flex-col gap-1 overflow-y-auto pr-1"
        >
          {entities.map((e) => {
            const selected = e.id === active?.id;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => onChange(e.id)}
                className={cn(
                  "flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left text-xs transition-colors duration-150",
                  selected
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{e.name}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                      selected
                        ? "bg-background/20 text-background"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {e.count}
                  </span>
                </span>
                {e.subtitle ? (
                  <span
                    className={cn(
                      "truncate text-[10px] leading-tight",
                      selected ? "text-background/70" : "text-muted-foreground",
                    )}
                  >
                    {e.subtitle}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

export function VisualLibraryEmptyPanel({
  hint,
  href,
  action,
}: {
  hint: string;
  href?: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-border/70 bg-card/40 flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center">
      <span
        className="flex size-11 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_12%,transparent)] text-[var(--lab-accent,var(--primary))]"
        aria-hidden
      >
        <ImageIcon className="size-5" />
      </span>
      <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
        {hint}
      </p>
      {href ? (
        <Link
          href={href}
          className="text-primary inline-flex items-center gap-1 text-xs font-semibold hover:underline"
        >
          Buka modul sumber
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      ) : null}
      {action}
    </div>
  );
}

export function VisualLibraryShell({
  toolbar,
  entityPicker,
  children,
}: {
  toolbar: ReactNode;
  entityPicker?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="border-border/70 bg-background/90 sticky top-[5.5rem] z-[9] -mx-1 border-b px-1 py-2 backdrop-blur-md supports-backdrop-filter:bg-background/75 xl:top-14">
        {toolbar}
      </div>

      <div
        className={cn(
          "grid gap-4",
          entityPicker ? "md:grid-cols-[13rem_1fr] lg:grid-cols-[14rem_1fr]" : "",
        )}
      >
        {entityPicker}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
