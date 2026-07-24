"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createScheduleEvent,
  deleteScheduleEvent,
  updateScheduleEvent,
} from "@/actions/schedule-events";
import { actionErrorMessage } from "@/lib/action-error-message";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { ParticipantPicker } from "./participant-picker";
import {
  ApplyToField,
  RecurrenceField,
  RecurrenceUntilField,
} from "./recurrence-fields";
import {
  RECURRENCE,
  RECURRENCE_ITEMS,
  RECURRENCE_SERIES_ITEMS,
  canManageEvent,
  defaultSlotOnDay,
  toDatetimeLocalValue,
  type ScheduleEventRow,
  type ScheduleRecurrenceValue,
  type UserPick,
} from "./schedule-types";

type ApplyTo = "SINGLE" | "SERIES";

/**
 * Satu dialog untuk buat DAN edit acara. Seluruh state form internal —
 * parent me-remount dengan `key` per sesi (pola editorSession products).
 */
export function EventFormDialog({
  open,
  onOpenChange,
  mode,
  editing,
  prefillDay,
  users,
  currentUserId,
  currentRole,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  editing: ScheduleEventRow | null;
  prefillDay: Date | null;
  users: UserPick[];
  currentUserId: string;
  currentRole: UserRole;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const manageable =
    mode === "create" ||
    (editing != null &&
      canManageEvent(currentRole, currentUserId, editing.createdById));

  const [title, setTitle] = useState(editing?.title ?? "");
  const [location, setLocation] = useState(editing?.location ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [startsAtLocal, setStartsAtLocal] = useState(() =>
    editing
      ? toDatetimeLocalValue(new Date(editing.startsAt))
      : prefillDay
        ? defaultSlotOnDay(prefillDay)
        : "",
  );
  const [recurrence, setRecurrence] = useState<ScheduleRecurrenceValue>(
    editing?.recurrence ?? RECURRENCE.NONE,
  );
  const [recurrenceUntilLocal, setRecurrenceUntilLocal] = useState(
    editing?.recurrenceUntil ? editing.recurrenceUntil.slice(0, 10) : "",
  );
  const [applyTo, setApplyTo] = useState<ApplyTo>("SINGLE");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() =>
    editing
      ? new Set(editing.participants.map((p) => p.user.id))
      : new Set([currentUserId]),
  );
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const isSeries = mode === "edit" && Boolean(editing?.seriesId);
  const showRecurrence =
    mode === "create" || (isSeries && applyTo === "SERIES");
  const recurrenceItems =
    mode === "create" ? RECURRENCE_ITEMS : RECURRENCE_SERIES_ITEMS;
  const fieldsDisabled = pending || !manageable;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manageable) return;
    if (!title.trim()) {
      toast.error("Isi judul acara.");
      return;
    }
    if (!startsAtLocal) {
      toast.error("Pilih tanggal & waktu mulai.");
      return;
    }
    const ids = [...selectedIds];
    if (ids.length === 0) {
      toast.error("Pilih minimal satu peserta untuk pengingat.");
      return;
    }
    if (mode === "create") {
      if (recurrence !== RECURRENCE.NONE && !recurrenceUntilLocal) {
        toast.error("Pilih tanggal selesai pengulangan.");
        return;
      }
    } else if (
      applyTo === "SERIES" &&
      recurrence !== RECURRENCE.NONE &&
      !recurrenceUntilLocal
    ) {
      toast.error("Pilih tanggal selesai pengulangan untuk seri.");
      return;
    }
    startTransition(async () => {
      try {
        const base = {
          title: title.trim(),
          description: description.trim() || null,
          location: location.trim() || null,
          startsAt: new Date(startsAtLocal),
          participantUserIds: ids,
          recurrence,
          recurrenceUntil:
            recurrence === RECURRENCE.NONE
              ? null
              : new Date(`${recurrenceUntilLocal}T23:59`),
        };
        if (mode === "create") {
          await createScheduleEvent(base);
          toast.success("Jadwal dibuat.");
        } else {
          await updateScheduleEvent({
            eventId: editing!.id,
            ...base,
            applyTo,
          });
          toast.success("Jadwal diperbarui.");
        }
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan."));
      }
    });
  }

  function onDelete() {
    if (!editing) return;
    startTransition(async () => {
      try {
        await deleteScheduleEvent({ eventId: editing.id });
        toast.success("Jadwal dihapus.");
        setConfirmDeleteOpen(false);
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(90vh,680px)] overflow-y-auto sm:max-w-lg">
          <form onSubmit={onSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {mode === "create"
                  ? "Buat acara"
                  : manageable
                    ? "Edit acara"
                    : "Detail acara"}
              </DialogTitle>
              <DialogDescription>
                {mode === "create"
                  ? "Isi detail acara dan pilih siapa yang mendapat pengingat (H-1 dan ±1 jam sebelum mulai)."
                  : "Ubah detail atau peserta pengingat."}
              </DialogDescription>
            </DialogHeader>
            {!manageable ? (
              <p className="rounded-md border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
                Hanya pembuat atau CEO yang bisa mengubah acara ini.
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="sch-title">Judul</Label>
              <Input
                id="sch-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Meeting, review, …"
                disabled={fieldsDisabled}
                maxLength={200}
              />
            </div>
            {isSeries ? (
              <ApplyToField
                value={applyTo}
                onChange={setApplyTo}
                disabled={fieldsDisabled}
              />
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sch-when">Waktu mulai</Label>
                <Input
                  id="sch-when"
                  type="datetime-local"
                  value={startsAtLocal}
                  onChange={(e) => setStartsAtLocal(e.target.value)}
                  disabled={fieldsDisabled}
                />
              </div>
              {showRecurrence ? (
                <RecurrenceField
                  items={recurrenceItems}
                  value={recurrence}
                  onChange={setRecurrence}
                  disabled={fieldsDisabled}
                />
              ) : null}
            </div>
            {showRecurrence && recurrence !== RECURRENCE.NONE ? (
              <RecurrenceUntilField
                value={recurrenceUntilLocal}
                onChange={setRecurrenceUntilLocal}
                disabled={fieldsDisabled}
              />
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="sch-loc">Lokasi / link (opsional)</Label>
              <Input
                id="sch-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ruang / Zoom …"
                disabled={fieldsDisabled}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sch-desc">Deskripsi (opsional)</Label>
              <Textarea
                id="sch-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={fieldsDisabled}
                maxLength={2000}
              />
            </div>
            <ParticipantPicker
              users={users}
              currentUserId={currentUserId}
              selectedIds={selectedIds}
              onChange={setSelectedIds}
              disabled={fieldsDisabled}
            />
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <div>
                {mode === "edit" && manageable ? (
                  <Button
                    type="button"
                    variant="destructive"
                    className="gap-2"
                    disabled={pending}
                    onClick={() => setConfirmDeleteOpen(true)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Hapus
                  </Button>
                ) : null}
              </div>
              <div className="flex gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={pending}
                >
                  {manageable ? "Batal" : "Tutup"}
                </Button>
                {manageable ? (
                  <Button type="submit" disabled={pending}>
                    {pending ? "Menyimpan…" : "Simpan"}
                  </Button>
                ) : null}
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {mode === "edit" && editing ? (
        <ConfirmDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          title={`Hapus jadwal "${editing.title}"?`}
          description={
            editing.seriesId
              ? "Notifikasi terkait dibatalkan. Untuk acara berulang, hanya kejadian ini yang dihapus."
              : "Notifikasi terkait dibatalkan."
          }
          confirmLabel="Hapus"
          pending={pending}
          onConfirm={onDelete}
        />
      ) : null}
    </>
  );
}
