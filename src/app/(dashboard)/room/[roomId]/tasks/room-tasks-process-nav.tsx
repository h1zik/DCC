"use client";

import Link from "next/link";
import { useState } from "react";
import { Settings2 } from "lucide-react";
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
        className="border-border bg-background/85 supports-backdrop-filter:bg-background/65 sticky top-14 z-10 flex items-center gap-1 border-b backdrop-blur-md"
      >
        <ul
          role="list"
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                    "focus-visible:ring-ring inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
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
        {canManagePhases ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="ml-0.5 h-8 shrink-0 gap-1 text-[11px]"
            onClick={() => setManageOpen(true)}
          >
            <Settings2 className="size-3" />
            <span className="hidden sm:inline">Kelola fase</span>
          </Button>
        ) : null}
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
