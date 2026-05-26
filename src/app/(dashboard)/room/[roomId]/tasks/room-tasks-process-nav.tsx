"use client";

import Link from "next/link";
import { useState } from "react";
import { Settings2, Workflow } from "lucide-react";
import { RoomCustomProcessPhasesDialog } from "@/components/room/room-custom-process-phases-dialog";
import {
  roomProcessPhaseKey,
  roomProcessPhaseLabel,
  type RoomProcessPhaseRef,
} from "@/lib/room-process-phase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RoomTasksProcessNav({
  roomId,
  phases,
  activePhase,
  showArchived,
  canManagePhases,
}: {
  roomId: string;
  phases: RoomProcessPhaseRef[];
  activePhase: RoomProcessPhaseRef;
  showArchived: boolean;
  canManagePhases: boolean;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const activeKey = roomProcessPhaseKey(activePhase);

  function hrefFor(phase: RoomProcessPhaseRef) {
    const qs = new URLSearchParams();
    qs.set("process", roomProcessPhaseKey(phase));
    if (showArchived) qs.set("archived", "1");
    return `/room/${roomId}/tasks?${qs.toString()}`;
  }

  return (
    <>
      <nav
        aria-label="Proses alur ruangan"
        className="border-border bg-background/85 supports-backdrop-filter:bg-background/65 sticky top-[8.5rem] z-10 rounded-xl border shadow-sm backdrop-blur-md"
      >
        <div className="text-muted-foreground border-border/60 flex items-center justify-between gap-2 border-b px-3 py-1.5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
            <Workflow className="size-3" aria-hidden />
            Fase proses
          </div>
          {canManagePhases ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-7 gap-1 text-[11px]"
              onClick={() => setManageOpen(true)}
            >
              <Settings2 className="size-3" />
              Kelola fase
            </Button>
          ) : null}
        </div>
        <ul
          role="list"
          className="flex w-full items-center gap-1 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {phases.map((phase) => {
            const key = roomProcessPhaseKey(phase);
            const active = key === activeKey;
            return (
              <li key={key} className="shrink-0">
                <Link
                  href={hrefFor(phase)}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-ring inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",

                  )}
                >
                  <span className="whitespace-nowrap">
                    {roomProcessPhaseLabel(phase)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {canManagePhases ? (
        <RoomCustomProcessPhasesDialog
          open={manageOpen}
          onOpenChange={setManageOpen}
          roomId={roomId}
        />
      ) : null}
    </>
  );
}
