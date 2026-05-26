"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { RoomPhaseOption } from "@/lib/room-member-phase-access";
import { toast } from "sonner";

type Props = {
  roomPhases: RoomPhaseOption[];
  selectedIds: string[];
  disabled?: boolean;
  onChange: (nextIds: string[]) => void;
};

export function RoomMemberPhaseCheckboxes({
  roomPhases,
  selectedIds,
  disabled,
  onChange,
}: Props) {
  if (roomPhases.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        Belum ada fase proses di ruangan ini. Tambahkan fase di menu Tasks → Kelola
        fase.
      </p>
    );
  }

  const selected = new Set(selectedIds);

  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
      {roomPhases.map((phase) => (
        <label
          key={phase.id}
          className="flex min-w-0 cursor-pointer items-center gap-2 text-xs"
        >
          <Checkbox
            checked={selected.has(phase.id)}
            disabled={disabled}
            onCheckedChange={(c) => {
              const next = new Set(selectedIds);
              if (c === true) {
                next.add(phase.id);
              } else {
                next.delete(phase.id);
                if (next.size === 0) {
                  toast.error("Minimal satu fase harus dipilih.");
                  return;
                }
              }
              onChange([...next]);
            }}
          />
          <span className="break-words">{phase.name}</span>
        </label>
      ))}
    </div>
  );
}
