"use client";

import Link from "next/link";
import { useState } from "react";
import { Settings2 } from "lucide-react";
import { RoomTaskGroupsDialog } from "@/components/room/room-task-groups-dialog";
import {
  ROOM_TASK_GROUP_UNGROUPED_LABEL,
  roomTaskGroupHref,
  type RoomTaskGroupRef,
} from "@/lib/room-task-group";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Tab kelompok tugas di ruangan non-brand. Sejajar dengan
 * `RoomTasksProcessNav` di ruangan brand, tapi tab pertama (&ldquo;Umum&rdquo;)
 * adalah lajur turunan untuk tugas tanpa kelompok, bukan baris DB.
 */
export function RoomTasksGroupNav({
  roomId,
  groups,
  activeGroup,
  showArchived,
  canManageGroups,
}: {
  roomId: string;
  groups: RoomTaskGroupRef[];
  activeGroup: RoomTaskGroupRef | null;
  showArchived: boolean;
  canManageGroups: boolean;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const activeId = activeGroup?.id ?? null;
  const tabs: (RoomTaskGroupRef | null)[] = [null, ...groups];

  return (
    <>
      <nav
        aria-label="Kelompok tugas ruangan"
        className="border-border bg-background/85 supports-backdrop-filter:bg-background/65 sticky top-14 z-10 flex items-center gap-1 border-b backdrop-blur-md"
      >
        <ul
          role="list"
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {groups.length > 0
            ? tabs.map((group) => {
                const active = (group?.id ?? null) === activeId;
                return (
                  <li key={group?.id ?? "__ungrouped__"} className="shrink-0">
                    <Link
                      href={roomTaskGroupHref(roomId, group, { showArchived })}
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
                        {group?.name ?? ROOM_TASK_GROUP_UNGROUPED_LABEL}
                      </span>
                    </Link>
                  </li>
                );
              })
            : null}
        </ul>
        {canManageGroups ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="ml-0.5 h-8 shrink-0 gap-1 text-[11px]"
            onClick={() => setManageOpen(true)}
          >
            <Settings2 className="size-3" />
            <span className="hidden sm:inline">Kelola kelompok</span>
          </Button>
        ) : null}
      </nav>
      {canManageGroups ? (
        <RoomTaskGroupsDialog
          open={manageOpen}
          onOpenChange={setManageOpen}
          roomId={roomId}
        />
      ) : null}
    </>
  );
}
