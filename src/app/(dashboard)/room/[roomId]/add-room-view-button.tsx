"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddRoomViewDialog } from "@/components/room/add-room-view-dialog";

export function AddRoomViewButton({ roomId }: { roomId: string }) {
  return (
    <AddRoomViewDialog
      roomId={roomId}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Tambah view ruangan"
        >
          <Plus className="size-3.5" aria-hidden />
          <span className="hidden whitespace-nowrap sm:inline">Tambah view</span>
        </Button>
      }
    />
  );
}
