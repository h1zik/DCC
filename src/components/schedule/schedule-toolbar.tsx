"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type ScheduleView = "month" | "agenda";

/** Baris toolbar tunggal: navigasi bulan, filter "Acara saya", switcher tampilan, aksi. */
export function ScheduleToolbar({
  view,
  onViewChange,
  monthLabel,
  onPrev,
  onNext,
  onToday,
  filterMine,
  onToggleMine,
  onCreate,
  onBulkDelete,
  bulkDisabled,
}: {
  view: ScheduleView;
  onViewChange: (view: ScheduleView) => void;
  monthLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  filterMine: boolean;
  onToggleMine: () => void;
  onCreate: () => void;
  onBulkDelete: () => void;
  bulkDisabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onToday}>
          Hari ini
        </Button>
        {view === "month" ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Bulan sebelumnya"
              onClick={onPrev}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Bulan berikutnya"
              onClick={onNext}
            >
              <ChevronRight className="size-4" />
            </Button>
          </>
        ) : null}
        <h2 className="text-xl font-semibold tracking-tight capitalize">
          {monthLabel}
        </h2>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleMine}
          aria-pressed={filterMine}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            filterMine
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Acara saya
        </button>
        <Tabs
          value={view}
          onValueChange={(v) => onViewChange(v as ScheduleView)}
        >
          <TabsList>
            <TabsTrigger value="month" className="max-sm:hidden">
              <CalendarDays className="size-4" aria-hidden />
              Bulan
            </TabsTrigger>
            <TabsTrigger value="agenda">
              <List className="size-4" aria-hidden />
              Agenda
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button type="button" onClick={onCreate}>
          <Plus className="size-4" aria-hidden />
          Buat acara
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Aksi lainnya"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem
              variant="destructive"
              disabled={bulkDisabled}
              onClick={onBulkDelete}
            >
              <Trash2 className="size-4" aria-hidden />
              Hapus massal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
