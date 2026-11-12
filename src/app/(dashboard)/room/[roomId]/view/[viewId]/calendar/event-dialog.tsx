"use client";

import { useState } from "react";
import { RoomCalendarEventKind } from "@prisma/client";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { dateToWibInput, wibInputToDate } from "@/lib/kol/time";
import {
  EVENT_KIND_LABEL,
  EVENT_KIND_ORDER,
  campaignStyle,
} from "@/lib/room-calendar/campaign-ui";
import { formatDayRange, isDayKey, type DayKey } from "@/lib/room-calendar/dates";
import { eventDays, type CalCampaign, type CalEvent } from "@/lib/room-calendar/types";
import { cn } from "@/lib/utils";
import { CampaignSwatch, KindIcon } from "./calendar-parts";

export type EventDraft = {
  id?: string;
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  startDate: DayKey;
  startTime: string;
  endDate: DayKey;
  endTime: string;
  campaignId: string | null;
  kind: RoomCalendarEventKind;
  done: boolean;
};

export type EventPayload = {
  id?: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  campaignId: string | null;
  kind: RoomCalendarEventKind;
  done: boolean;
};

export function newEventDraft(day: DayKey, campaignId: string | null = null): EventDraft {
  return {
    title: "",
    description: "",
    location: "",
    allDay: false,
    startDate: day,
    startTime: "09:00",
    endDate: day,
    endTime: "10:00",
    campaignId,
    kind: RoomCalendarEventKind.GENERAL,
    done: false,
  };
}

export function draftFromEvent(ev: CalEvent): EventDraft {
  const [startDate, startTime] = dateToWibInput(ev.startsAt).split("T") as [string, string];
  const [endDateRaw, endTime] = (ev.endsAt ? dateToWibInput(ev.endsAt) : "").split("T");
  return {
    id: ev.id,
    title: ev.title,
    description: ev.description ?? "",
    location: ev.location ?? "",
    allDay: ev.allDay,
    startDate,
    startTime,
    // Sepanjang hari disimpan sampai 23.59; pakai hari yang benar-benar disentuh.
    endDate: ev.allDay ? eventDays(ev).end : endDateRaw || startDate,
    endTime: endTime || startTime,
    campaignId: ev.campaignId,
    kind: ev.kind,
    done: Boolean(ev.doneAt),
  };
}

export function EventDialog({
  draft,
  openKey,
  campaigns,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  /** null = tertutup. */
  draft: EventDraft | null;
  openKey: number;
  campaigns: CalCampaign[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: EventPayload) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}) {
  return (
    <Dialog
      open={draft !== null}
      onOpenChange={(next) => {
        if (!next && !saving) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {draft ? (
          <EventForm
            key={openKey}
            initial={draft}
            campaigns={campaigns}
            saving={saving}
            onClose={onClose}
            onSave={onSave}
            onDelete={onDelete}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EventForm({
  initial,
  campaigns,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  initial: EventDraft;
  campaigns: CalCampaign[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: EventPayload) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [form, setForm] = useState<EventDraft>(initial);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isEdit = Boolean(form.id);
  const set = (patch: Partial<EventDraft>) => setForm((f) => ({ ...f, ...patch }));

  const campaign = campaigns.find((c) => c.id === form.campaignId) ?? null;
  const outsideCampaign =
    campaign && isDayKey(form.startDate)
      ? form.startDate < campaign.startDate || form.startDate > campaign.endDate
      : false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) {
      toast.error("Isi judul aktivitas dulu.");
      return;
    }
    if (!isDayKey(form.startDate)) {
      toast.error("Tanggal mulai belum diisi.");
      return;
    }
    const endDate = isDayKey(form.endDate) ? form.endDate : form.startDate;
    let startsAt: Date;
    let endsAt: Date | null;
    try {
      startsAt = wibInputToDate(`${form.startDate}T${form.allDay ? "00:00" : form.startTime || "00:00"}`);
      endsAt = form.allDay
        ? wibInputToDate(`${endDate}T23:59`)
        : form.endTime
          ? wibInputToDate(`${endDate}T${form.endTime}`)
          : null;
    } catch {
      toast.error("Tanggal atau jam tidak valid.");
      return;
    }
    if (endsAt && endsAt.getTime() < startsAt.getTime()) {
      toast.error("Waktu selesai tidak boleh sebelum waktu mulai.");
      return;
    }
    await onSave({
      id: form.id,
      title,
      description: form.description.trim() || null,
      location: form.location.trim() || null,
      startsAt,
      endsAt,
      allDay: form.allDay,
      campaignId: form.campaignId,
      kind: form.kind,
      done: form.done,
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Ubah aktivitas" : "Aktivitas baru"}</DialogTitle>
        <DialogDescription className="text-xs">
          Jam mengikuti WIB. Aktivitas hanya tampil di kalender ruangan ini.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="event-title">Judul</Label>
          <Input
            id="event-title"
            value={form.title}
            maxLength={160}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Contoh: Shoot katalog 11.11"
            autoFocus
          />
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Jenis</legend>
          <div className="flex flex-wrap gap-1.5">
            {EVENT_KIND_ORDER.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={form.kind === k}
                onClick={() => set({ kind: k })}
                className={cn(
                  "focus-visible:ring-ring inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs outline-none transition-colors focus-visible:ring-2",
                  form.kind === k
                    ? "border-foreground bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                <KindIcon kind={k} className="size-3.5" />
                {EVENT_KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Campaign</legend>
          <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            <button
              type="button"
              aria-pressed={form.campaignId === null}
              onClick={() => set({ campaignId: null })}
              className={cn(
                "focus-visible:ring-ring inline-flex h-7 items-center rounded-md border px-2 text-xs outline-none transition-colors focus-visible:ring-2",
                form.campaignId === null
                  ? "border-foreground bg-muted font-medium"
                  : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              Tanpa campaign
            </button>
            {campaigns.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={form.campaignId === c.id}
                onClick={() => set({ campaignId: c.id })}
                style={campaignStyle(c.color)}
                className={cn(
                  "focus-visible:ring-ring inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border px-2 text-xs outline-none transition-colors focus-visible:ring-2",
                  form.campaignId === c.id
                    ? "border-[var(--cmp)] bg-[color-mix(in_oklab,var(--cmp)_16%,transparent)] font-medium"
                    : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                <CampaignSwatch color={c.color} status={c.status} className="h-2.5 w-3.5" />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
          {campaigns.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Belum ada campaign di kalender ini. Aktivitas bisa dikaitkan belakangan.
            </p>
          ) : null}
          {outsideCampaign && campaign ? (
            <p className="text-muted-foreground text-xs">
              Tanggal ini di luar rentang campaign (
              {formatDayRange(campaign.startDate, campaign.endDate)}). Tetap bisa disimpan, misalnya
              untuk persiapan.
            </p>
          ) : null}
        </fieldset>

        <div className="space-y-2">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="event-start">Mulai</Label>
              <div className="flex gap-1.5">
                <Input
                  id="event-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => {
                    const startDate = e.target.value;
                    set({
                      startDate,
                      endDate: form.endDate < startDate ? startDate : form.endDate,
                    });
                  }}
                  className="min-w-0 flex-1"
                />
                {!form.allDay ? (
                  <Input
                    type="time"
                    aria-label="Jam mulai"
                    value={form.startTime}
                    onChange={(e) => set({ startTime: e.target.value })}
                    className="w-[6.5rem]"
                  />
                ) : null}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-end">Selesai</Label>
              <div className="flex gap-1.5">
                <Input
                  id="event-end"
                  type="date"
                  value={form.endDate}
                  min={form.startDate}
                  onChange={(e) => set({ endDate: e.target.value })}
                  className="min-w-0 flex-1"
                />
                {!form.allDay ? (
                  <Input
                    type="time"
                    aria-label="Jam selesai"
                    value={form.endTime}
                    onChange={(e) => set({ endTime: e.target.value })}
                    className="w-[6.5rem]"
                  />
                ) : null}
              </div>
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.allDay}
              onCheckedChange={(v) => set({ allDay: Boolean(v) })}
            />
            Sepanjang hari
          </label>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="event-location">Lokasi</Label>
          <Input
            id="event-location"
            value={form.location}
            maxLength={200}
            onChange={(e) => set({ location: e.target.value })}
            placeholder="Studio, link live, atau nama toko"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="event-notes">Catatan</Label>
          <Textarea
            id="event-notes"
            value={form.description}
            maxLength={2000}
            onChange={(e) => set({ description: e.target.value })}
            rows={3}
          />
        </div>

        {isEdit ? (
          <label className="inline-flex items-center gap-2 text-sm">
            <Checkbox checked={form.done} onCheckedChange={(v) => set({ done: Boolean(v) })} />
            Sudah selesai
          </label>
        ) : null}
      </div>

      <DialogFooter className="flex-row items-center justify-between sm:justify-between">
        {confirmDelete && form.id ? (
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <p className="text-sm">Hapus aktivitas ini?</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => setConfirmDelete(false)}
              >
                Jangan hapus
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={saving}
                onClick={() => void onDelete(form.id!)}
              >
                Hapus aktivitas
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div>
              {isEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => setConfirmDelete(true)}
                  className="text-destructive hover:text-destructive gap-1"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Hapus
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={saving} onClick={onClose}>
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                Simpan aktivitas
              </Button>
            </div>
          </>
        )}
      </DialogFooter>
    </form>
  );
}
