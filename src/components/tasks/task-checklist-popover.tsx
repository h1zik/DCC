"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CheckSquare, ChevronDown } from "lucide-react";
import { toggleChecklistItem } from "@/actions/tasks";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type TaskChecklistItemLite = {
  id: string;
  title: string;
  done: boolean;
};

type Props = {
  items: TaskChecklistItemLite[];
  doneCount: number;
  totalCount: number;
  /** Tampilan trigger lebih ringkas (mis. halaman My Tasks). */
  compact?: boolean;
  triggerClassName?: string;
  /** Posisi dropdown relatif ke trigger (mis. kanan kartu Kanban → `end`). */
  contentAlign?: "start" | "center" | "end";
};

/**
 * Dropdown sub-tugas dengan checklist langsung — untuk Kanban & kartu ringkas.
 * Tidak dirender jika tidak ada item checklist.
 */
export function TaskChecklistPopover({
  items,
  doneCount,
  totalCount,
  compact,
  triggerClassName,
  contentAlign = "start",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (totalCount === 0) return null;

  async function onToggle(itemId: string, next: boolean) {
    setPendingId(itemId);
    try {
      await toggleChecklistItem(itemId, next);
      router.refresh();
    } catch (e) {
      toast.error(
        actionErrorMessage(e, "Gagal memperbarui sub-tugas."));
    } finally {
      setPendingId(null);
    }
  }

  function stopBubble(e: React.SyntheticEvent) {
    e.stopPropagation();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        aria-label={`Sub-tugas: ${doneCount} dari ${totalCount} selesai`}
        className={cn(
          "text-muted-foreground hover:bg-muted/80 hover:text-foreground inline-flex shrink-0 items-center gap-0.5 rounded-md border border-transparent px-1 py-0.5 text-[10px] font-medium tabular-nums outline-none transition-colors",
          compact ? "px-1.5 py-1" : "",
          triggerClassName,
        )}
        onClick={stopBubble}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <CheckSquare className="size-2.5" aria-hidden />
        <span>
          {doneCount}/{totalCount}
        </span>
        <ChevronDown className="size-2.5 opacity-70" aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        className="flex max-h-72 w-[min(100vw-2rem,20rem)] flex-col gap-2 overflow-hidden p-2"
        align={contentAlign}
        onClick={stopBubble}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p className="text-muted-foreground px-1 text-[11px] font-semibold tracking-wide uppercase">
          Sub-tugas
        </p>
        <ul className="max-h-56 space-y-1 overflow-y-auto overscroll-contain px-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <label
                className={cn(
                  "hover:bg-muted/50 flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 text-xs",
                  pendingId === item.id && "opacity-60",
                )}
              >
                <Checkbox
                  checked={item.done}
                  disabled={pendingId === item.id}
                  className="mt-0.5"
                  onCheckedChange={(v) => void onToggle(item.id, v === true)}
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 leading-snug",
                    item.done
                      ? "text-muted-foreground line-through"
                      : "text-foreground",
                  )}
                >
                  {item.title}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground border-border/60 border-t px-1 pt-1 text-[10px] leading-relaxed">
          Tambah / ubah teks sub-tugas dari panel detail tugas.
        </p>
      </PopoverContent>
    </Popover>
  );
}
