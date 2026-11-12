"use client";

import { useMemo, useState } from "react";
import { ContentPlanUsage, RoomCampaignStatus } from "@prisma/client";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  CAMPAIGN_BAND_CLASS,
  CAMPAIGN_CHANNEL_KEYS,
  CAMPAIGN_CHANNEL_LABEL,
  CAMPAIGN_COLORS,
  CAMPAIGN_COLOR_KEYS,
  CAMPAIGN_STATUS_LABEL,
  CAMPAIGN_STATUS_ORDER,
  OBJECTIVE_HINT,
  OBJECTIVE_LABEL,
  OBJECTIVE_ORDER,
  campaignStyle,
  isCampaignColorKey,
  type CampaignChannelKey,
  type CampaignColorKey,
} from "@/lib/room-calendar/campaign-ui";
import {
  addDaysKey,
  diffDays,
  formatDayShort,
  isDayKey,
  type DayKey,
} from "@/lib/room-calendar/dates";
import {
  compareEvents,
  eventDays,
  memberName,
  type CalCampaign,
  type CalEvent,
  type CalMember,
} from "@/lib/room-calendar/types";
import { cn } from "@/lib/utils";
import { EventRow, MemberAvatar } from "./calendar-parts";

export type CampaignDraft = {
  id?: string;
  name: string;
  description: string;
  startDate: DayKey;
  endDate: DayKey;
  color: CampaignColorKey;
  status: RoomCampaignStatus;
  objective: ContentPlanUsage | null;
  channels: string[];
  picUserIds: string[];
  /** Hanya digit; kosong = tidak diisi. */
  budget: string;
  kpiTarget: string;
};

export type CampaignPayload = {
  id?: string;
  name: string;
  description: string | null;
  startDate: DayKey;
  endDate: DayKey;
  color: CampaignColorKey;
  status: RoomCampaignStatus;
  objective: ContentPlanUsage | null;
  channels: CampaignChannelKey[];
  picUserIds: string[];
  budget: number | null;
  kpiTarget: string | null;
};

export function newCampaignDraft(startDate: DayKey, color: CampaignColorKey): CampaignDraft {
  return {
    name: "",
    description: "",
    startDate,
    endDate: addDaysKey(startDate, 6),
    color,
    status: RoomCampaignStatus.PLANNED,
    objective: null,
    channels: [],
    picUserIds: [],
    budget: "",
    kpiTarget: "",
  };
}

export function draftFromCampaign(c: CalCampaign): CampaignDraft {
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? "",
    startDate: c.startDate,
    endDate: c.endDate,
    color: isCampaignColorKey(c.color) ? c.color : "sky",
    status: c.status,
    objective: c.objective,
    channels: c.channels,
    picUserIds: c.picUserIds,
    budget: c.budget == null ? "" : String(Math.round(c.budget)),
    kpiTarget: c.kpiTarget ?? "",
  };
}

export function CampaignSheet({
  draft,
  openKey,
  members,
  events,
  saving,
  onClose,
  onSave,
  onDelete,
  onOpenEvent,
  onToggleDone,
  onAddEvent,
}: {
  /** null = tertutup. */
  draft: CampaignDraft | null;
  openKey: number;
  members: CalMember[];
  /** Semua aktivitas kalender; disaring ke campaign ini di dalam. */
  events: CalEvent[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: CampaignPayload) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onOpenEvent: (event: CalEvent) => void;
  onToggleDone: (event: CalEvent, done: boolean) => void;
  onAddEvent: (campaign: { id: string; startDate: DayKey }) => void;
}) {
  const [dirty, setDirty] = useState(false);
  return (
    <Sheet
      open={draft !== null}
      // Perubahan yang belum disimpan tidak hilang karena salah klik di luar panel.
      disablePointerDismissal={dirty}
      onOpenChange={(next) => {
        if (!next && !saving) {
          setDirty(false);
          onClose();
        }
      }}
    >
      <SheetContent
        side="right"
        className="flex w-full max-w-full flex-col gap-0 border-l p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        {draft ? (
          <CampaignForm
            key={openKey}
            initial={draft}
            members={members}
            events={events}
            saving={saving}
            onDirtyChange={setDirty}
            onClose={() => {
              setDirty(false);
              onClose();
            }}
            onSave={onSave}
            onDelete={onDelete}
            onOpenEvent={onOpenEvent}
            onToggleDone={onToggleDone}
            onAddEvent={onAddEvent}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function CampaignForm({
  initial,
  members,
  events,
  saving,
  onDirtyChange,
  onClose,
  onSave,
  onDelete,
  onOpenEvent,
  onToggleDone,
  onAddEvent,
}: {
  initial: CampaignDraft;
  members: CalMember[];
  events: CalEvent[];
  saving: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onClose: () => void;
  onSave: (payload: CampaignPayload) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onOpenEvent: (event: CalEvent) => void;
  onToggleDone: (event: CalEvent, done: boolean) => void;
  onAddEvent: (campaign: { id: string; startDate: DayKey }) => void;
}) {
  const [form, setForm] = useState<CampaignDraft>(initial);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isEdit = Boolean(form.id);

  function set(patch: Partial<CampaignDraft>) {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
    onDirtyChange(true);
  }

  /**
   * Membuka aktivitas menutup panel ini. Selama ada perubahan yang belum
   * disimpan, itu ditahan dulu supaya isian campaign tidak hilang.
   */
  function leaveTo(go: () => void) {
    if (dirty) {
      toast.info("Simpan atau batalkan perubahan campaign dulu.");
      return;
    }
    go();
  }

  const ownEvents = useMemo(
    () => (form.id ? events.filter((e) => e.campaignId === form.id).sort(compareEvents) : []),
    [events, form.id],
  );
  const doneCount = ownEvents.filter((e) => e.doneAt).length;

  const validDates = isDayKey(form.startDate) && isDayKey(form.endDate);
  const duration = validDates ? diffDays(form.startDate, form.endDate) + 1 : 0;
  const budgetNumber = form.budget ? Number(form.budget) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.error("Isi nama campaign dulu.");
      return;
    }
    if (!validDates) {
      toast.error("Tanggal mulai dan selesai harus diisi.");
      return;
    }
    if (form.endDate < form.startDate) {
      toast.error("Tanggal selesai tidak boleh sebelum tanggal mulai.");
      return;
    }
    const ok = await onSave({
      id: form.id,
      name,
      description: form.description.trim() || null,
      startDate: form.startDate,
      endDate: form.endDate,
      color: form.color,
      status: form.status,
      objective: form.objective,
      channels: form.channels.filter((c): c is CampaignChannelKey =>
        (CAMPAIGN_CHANNEL_KEYS as readonly string[]).includes(c),
      ),
      picUserIds: form.picUserIds,
      budget: budgetNumber,
      kpiTarget: form.kpiTarget.trim() || null,
    });
    if (ok) {
      setDirty(false);
      onDirtyChange(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" style={campaignStyle(form.color)}>
      <SheetHeader className="border-b pr-12">
        <SheetTitle>{isEdit ? "Ubah campaign" : "Campaign baru"}</SheetTitle>
        <SheetDescription className="text-xs">
          Campaign tampil sebagai pita berwarna di kalender dan mengelompokkan aktivitasnya.
        </SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <div className="space-y-1.5">
          <Label htmlFor="campaign-name">Nama campaign</Label>
          <Input
            id="campaign-name"
            value={form.name}
            maxLength={120}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Contoh: 11.11 Mega Sale"
            autoFocus={!isEdit}
          />
        </div>

        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-start">Mulai</Label>
              <Input
                id="campaign-start"
                type="date"
                value={form.startDate}
                onChange={(e) => {
                  const startDate = e.target.value;
                  // Menggeser tanggal mulai ikut menggeser selesai agar durasinya tetap.
                  const keep =
                    isDayKey(startDate) && validDates
                      ? addDaysKey(startDate, diffDays(form.startDate, form.endDate))
                      : form.endDate;
                  set({ startDate, endDate: keep });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-end">Selesai</Label>
              <Input
                id="campaign-end"
                type="date"
                value={form.endDate}
                min={form.startDate}
                onChange={(e) => set({ endDate: e.target.value })}
              />
            </div>
          </div>
          {duration > 0 ? (
            <p className="text-muted-foreground text-xs tabular-nums">{duration} hari</p>
          ) : null}
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Warna pita</legend>
          <div className="flex flex-wrap gap-2">
            {CAMPAIGN_COLOR_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={form.color === key}
                aria-label={CAMPAIGN_COLORS[key].label}
                title={CAMPAIGN_COLORS[key].label}
                onClick={() => set({ color: key })}
                style={{ backgroundColor: CAMPAIGN_COLORS[key].value }}
                className={cn(
                  "focus-visible:ring-ring flex size-7 items-center justify-center rounded-md text-white outline-none transition-transform focus-visible:ring-2 focus-visible:ring-offset-2",
                  form.color === key
                    ? "ring-foreground ring-offset-background ring-2 ring-offset-2"
                    : "hover:scale-105",
                )}
              >
                {form.color === key ? <Check className="size-4" aria-hidden /> : null}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Status</legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {CAMPAIGN_STATUS_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={form.status === s}
                onClick={() => set({ status: s })}
                className={cn(
                  "focus-visible:ring-ring rounded-md border p-1.5 text-left text-xs outline-none transition-colors focus-visible:ring-2",
                  form.status === s
                    ? "border-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                <span
                  aria-hidden
                  className={cn("mb-1.5 block h-3 rounded-[3px]", CAMPAIGN_BAND_CLASS[s])}
                />
                {CAMPAIGN_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Objective</legend>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {OBJECTIVE_ORDER.map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={form.objective === o}
                onClick={() => set({ objective: form.objective === o ? null : o })}
                className={cn(
                  "focus-visible:ring-ring rounded-md border px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2",
                  form.objective === o
                    ? "border-foreground bg-muted"
                    : "hover:bg-muted/60",
                )}
              >
                <span className="block text-xs font-medium">{OBJECTIVE_LABEL[o]}</span>
                <span className="text-muted-foreground block text-[11px] leading-snug">
                  {OBJECTIVE_HINT[o]}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Channel</legend>
          <div className="flex flex-wrap gap-1.5">
            {CAMPAIGN_CHANNEL_KEYS.map((key) => {
              const on = form.channels.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ channels: toggle(form.channels, key) })}
                  className={cn(
                    "focus-visible:ring-ring h-7 rounded-md border px-2 text-xs outline-none transition-colors focus-visible:ring-2",
                    on
                      ? "border-foreground bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                >
                  {CAMPAIGN_CHANNEL_LABEL[key]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">PIC</legend>
          {members.length === 0 ? (
            <p className="text-muted-foreground text-xs">Ruangan ini belum punya anggota.</p>
          ) : (
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {members.map((m) => {
                const on = form.picUserIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ picUserIds: toggle(form.picUserIds, m.id) })}
                    className={cn(
                      "focus-visible:ring-ring inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-1 text-xs outline-none transition-colors focus-visible:ring-2",
                      on ? "border-foreground bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60",
                    )}
                  >
                    <MemberAvatar member={m} className="ring-0" />
                    <span className="truncate">{memberName(m)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="campaign-budget">Budget</Label>
          <div className="relative">
            <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm">
              Rp
            </span>
            <Input
              id="campaign-budget"
              inputMode="numeric"
              autoComplete="off"
              value={form.budget ? Number(form.budget).toLocaleString("id-ID") : ""}
              onChange={(e) => set({ budget: e.target.value.replace(/\D/g, "").slice(0, 15) })}
              placeholder="0"
              className="pl-9 tabular-nums"
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Catatan perencanaan saja, tidak tercatat di Finance.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="campaign-kpi">Target KPI</Label>
          <Textarea
            id="campaign-kpi"
            value={form.kpiTarget}
            maxLength={500}
            onChange={(e) => set({ kpiTarget: e.target.value })}
            rows={2}
            placeholder="Contoh: GMV Rp 250 jt, reach 1,5 juta, 40 konten tayang"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="campaign-notes">Catatan</Label>
          <Textarea
            id="campaign-notes"
            value={form.description}
            maxLength={2000}
            onChange={(e) => set({ description: e.target.value })}
            rows={3}
            placeholder="Mekanisme promo, pesan utama, hal yang perlu diingat tim"
          />
        </div>

        {isEdit && form.id ? (
          <section className="border-t pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">
                Aktivitas
                {ownEvents.length > 0 ? (
                  <span className="text-muted-foreground ml-1.5 font-normal tabular-nums">
                    {doneCount} dari {ownEvents.length} selesai
                  </span>
                ) : null}
              </h3>
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="gap-1"
                onClick={() => leaveTo(() => onAddEvent({ id: form.id!, startDate: initial.startDate }))}
              >
                <Plus aria-hidden />
                Tambah
              </Button>
            </div>
            {ownEvents.length === 0 ? (
              <p className="text-muted-foreground mt-1.5 text-xs">
                Belum ada aktivitas. Tambahkan shoot, posting, live, atau promo yang termasuk
                campaign ini.
              </p>
            ) : (
              <div className="mt-1.5 -ml-1.5">
                {ownEvents.map((ev) => (
                  <EventRow
                    key={ev.id}
                    event={ev}
                    campaign={{ color: form.color, name: form.name }}
                    showCampaign={false}
                    dateLabel={formatDayShort(eventDays(ev).start)}
                    onOpen={(event) => leaveTo(() => onOpenEvent(event))}
                    onToggleDone={onToggleDone}
                  />
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>

      <div className="bg-muted/40 border-t p-3">
        {confirmDelete && form.id ? (
          <div className="space-y-2">
            <p className="text-sm">
              Hapus campaign ini?{" "}
              {ownEvents.length > 0
                ? `${ownEvents.length} aktivitasnya tetap ada di kalender, hanya tidak lagi terkait campaign.`
                : "Tindakan ini tidak bisa dibatalkan."}
            </p>
            <div className="flex justify-end gap-2">
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
                Hapus campaign
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
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
                Simpan campaign
              </Button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
