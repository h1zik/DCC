"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import { deleteScheduleEventsBulk } from "@/actions/schedule-events";
import { actionErrorMessage } from "@/lib/action-error-message";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { displayName, type ScheduleEventRow } from "./schedule-types";

/**
 * Hapus massal jadwal yang bisa dikelola pengguna. Konfirmasi akhir lewat
 * ConfirmDialog (bukan window.confirm). Parent me-remount dengan `key`.
 */
export function BulkDeleteDialog({
  open,
  onOpenChange,
  events,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: ScheduleEventRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return events;
    return events.filter((ev) => {
      const starts = new Date(ev.startsAt);
      const haystack = [
        ev.title,
        ev.location ?? "",
        ev.createdBy.name ?? "",
        ev.createdBy.email,
        format(starts, "dd MMM yyyy HH:mm", { locale: idLocale }),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [filter, events]);

  function toggle(eventId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }

  function onConfirmDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      toast.error("Pilih minimal satu jadwal.");
      return;
    }
    startTransition(async () => {
      try {
        await deleteScheduleEventsBulk({ eventIds: ids });
        toast.success(`${ids.length} jadwal dihapus.`);
        setConfirmOpen(false);
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal hapus massal."));
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus jadwal massal</DialogTitle>
            <DialogDescription>
              Pilih jadwal dari seluruh data yang ingin dihapus sekaligus.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              placeholder="Cari judul, lokasi, pembuat, tanggal…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              disabled={pending}
            />
            <ScrollArea className="h-72 rounded-md border border-border p-2">
              {filtered.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Tidak ada jadwal yang cocok dengan filter.
                </p>
              ) : (
                <ul className="space-y-1">
                  {filtered.map((ev) => (
                    <li
                      key={ev.id}
                      className="flex items-start gap-2 rounded-md px-1 py-1 text-sm transition-colors hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`bulk-${ev.id}`}
                        checked={selectedIds.has(ev.id)}
                        onCheckedChange={() => toggle(ev.id)}
                        disabled={pending}
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor={`bulk-${ev.id}`}
                        className="min-w-0 flex-1 cursor-pointer flex-col items-start gap-0 leading-snug font-normal"
                      >
                        <span className="block font-medium">{ev.title}</span>
                        <span className="text-muted-foreground block text-xs">
                          {format(new Date(ev.startsAt), "dd MMM yyyy HH:mm", {
                            locale: idLocale,
                          })}{" "}
                          · {displayName(ev.createdBy)}
                        </span>
                      </Label>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={pending || selectedIds.size === 0}
            >
              {pending ? "Menghapus…" : `Hapus (${selectedIds.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Hapus ${selectedIds.size} jadwal terpilih?`}
        description="Tindakan ini tidak dapat dibatalkan. Notifikasi terkait dibatalkan."
        confirmLabel="Hapus"
        pending={pending}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}
