"use client";

import { useRouter } from "next/navigation";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { ChartGantt, ChevronLeft, ChevronRight, LayoutGrid, ListTodo, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  deleteRoomCalendarEvent,
  deleteRoomCampaign,
  moveRoomCalendarEvent,
  rescheduleRoomCampaign,
  setRoomCalendarEventDone,
  upsertRoomCalendarEvent,
  upsertRoomCampaign,
} from "@/actions/room-view-calendar";
import { Button } from "@/components/ui/button";
import { actionErrorMessage } from "@/lib/action-error-message";
import { wibDayKey } from "@/lib/kol/time";
import { nextCampaignColor } from "@/lib/room-calendar/campaign-ui";
import {
  firstDayOfMonth,
  formatMonthLong,
  lastDayOfMonth,
  monthKeyOf,
  shiftMonth,
  type DayKey,
} from "@/lib/room-calendar/dates";
import { buildDayIndex, EMPTY_DAY_ITEMS } from "@/lib/room-calendar/day-index";
import { momentsBetween, type Moment } from "@/lib/room-calendar/moments";
import {
  campaignProgress,
  type CalCampaign,
  type CalContentPost,
  type CalEvent,
  type CalKolPost,
  type CalendarData,
} from "@/lib/room-calendar/types";
import { CalendarAgenda } from "./calendar-agenda";
import { CalendarLayersButton } from "./calendar-layers";
import { CalendarMonth } from "./calendar-month";
import { Segmented } from "./calendar-parts";
import {
  updateCalendarPrefs,
  useCalendarPrefs,
  useIsSmallScreen,
  type CalendarViewMode,
} from "./calendar-prefs";
import { CalendarRail } from "./calendar-rail";
import { CalendarTimeline } from "./calendar-timeline";
import {
  CampaignSheet,
  draftFromCampaign,
  newCampaignDraft,
  type CampaignDraft,
  type CampaignPayload,
} from "./campaign-sheet";
import { DayPopover } from "./day-popover";
import {
  EventDialog,
  draftFromEvent,
  newEventDraft,
  type EventDraft,
  type EventPayload,
} from "./event-dialog";

const DAY_MS = 86_400_000;

// Referensi tetap untuk lapisan yang dimatikan, supaya memo di bawahnya tidak dihitung ulang.
const NO_CONTENT_POSTS: CalContentPost[] = [];
const NO_KOL_POSTS: CalKolPost[] = [];
const NO_MOMENTS: Moment[] = [];

type EventPatch =
  | { type: "move"; id: string; startsAt: string; endsAt: string | null }
  | { type: "done"; id: string; done: boolean };

type CampaignPatch = { type: "reschedule"; id: string; startDate: DayKey; endDate: DayKey };

function reduceEvents(state: CalEvent[], patch: EventPatch): CalEvent[] {
  switch (patch.type) {
    case "move":
      return state.map((e) =>
        e.id === patch.id ? { ...e, startsAt: patch.startsAt, endsAt: patch.endsAt } : e,
      );
    case "done":
      return state.map((e) =>
        e.id === patch.id
          ? { ...e, doneAt: patch.done ? (e.doneAt ?? new Date().toISOString()) : null }
          : e,
      );
  }
}

function reduceCampaigns(state: CalCampaign[], patch: CampaignPatch): CalCampaign[] {
  return state.map((c) =>
    c.id === patch.id ? { ...c, startDate: patch.startDate, endDate: patch.endDate } : c,
  );
}

/**
 * Kalender ruangan sebagai papan perencanaan campaign: tiga tampilan (Bulan,
 * Linimasa, Agenda) di atas data yang sama. Komponen ini memegang state
 * bersama dan semua mutasi; tampilan di bawahnya hanya menggambar.
 */
export function CalendarViewClient({ viewId, data }: { viewId: string; data: CalendarData }) {
  const router = useRouter();
  const prefs = useCalendarPrefs();
  const isSmall = useIsSmallScreen();
  const view: CalendarViewMode = prefs.view ?? (isSmall ? "agenda" : "month");
  const { layers } = prefs;

  const [today] = useState(() => wibDayKey(new Date()));
  const [month, setMonth] = useState(() => monthKeyOf(wibDayKey(new Date())));
  const [jumpNonce, setJumpNonce] = useState(0);
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(() => new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [dayPop, setDayPop] = useState<{ day: DayKey; anchor: HTMLElement } | null>(null);
  const [eventDraft, setEventDraft] = useState<EventDraft | null>(null);
  const [campaignDraft, setCampaignDraft] = useState<CampaignDraft | null>(null);
  const [openKey, setOpenKey] = useState(0);
  const [saving, startSaving] = useTransition();
  const [, startMutation] = useTransition();

  const [events, patchEvents] = useOptimistic(data.events, reduceEvents);
  const [campaigns, patchCampaigns] = useOptimistic(data.campaigns, reduceCampaigns);

  const campaignById = useMemo(
    () => new Map(campaigns.map((c) => [c.id, c] as const)),
    [campaigns],
  );
  const memberById = useMemo(
    () => new Map(data.members.map((m) => [m.id, m] as const)),
    [data.members],
  );
  const progress = useMemo(() => campaignProgress(events), [events]);

  // Fokus ke campaign yang sudah dihapus dianggap tidak ada.
  const focus = focusId && campaignById.has(focusId) ? focusId : null;
  const hiddenCount = campaigns.filter((c) => hiddenIds.has(c.id)).length;

  const visibleCampaigns = useMemo(
    () => campaigns.filter((c) => (focus ? c.id === focus : !hiddenIds.has(c.id))),
    [campaigns, focus, hiddenIds],
  );
  const visibleEvents = useMemo(() => {
    const ids = new Set(visibleCampaigns.map((c) => c.id));
    return events.filter((e) =>
      e.campaignId && campaignById.has(e.campaignId)
        ? ids.has(e.campaignId)
        : layers.loose && !focus,
    );
  }, [events, visibleCampaigns, campaignById, layers.loose, focus]);

  const contentPosts = layers.content ? data.contentPosts : NO_CONTENT_POSTS;
  const kolPosts = layers.kol && data.kolPosts ? data.kolPosts : NO_KOL_POSTS;

  /** Momen untuk Bulan & Agenda: sebulan sebelum sampai tiga bulan sesudah bulan terpilih. */
  const moments = useMemo(
    () =>
      layers.moments
        ? momentsBetween(
            firstDayOfMonth(shiftMonth(month, -1)),
            lastDayOfMonth(shiftMonth(month, 3)),
          )
        : NO_MOMENTS,
    [layers.moments, month],
  );

  const dayPopItems = useMemo(() => {
    if (!dayPop) return EMPTY_DAY_ITEMS;
    return (
      buildDayIndex(
        { campaigns: visibleCampaigns, events: visibleEvents, contentPosts, kolPosts },
        [dayPop.day],
      ).get(dayPop.day) ?? EMPTY_DAY_ITEMS
    );
  }, [dayPop, visibleCampaigns, visibleEvents, contentPosts, kolPosts]);
  const dayPopMoments = useMemo(
    () => (dayPop && layers.moments ? momentsBetween(dayPop.day, dayPop.day) : NO_MOMENTS),
    [dayPop, layers.moments],
  );

  const isCurrentMonth = monthKeyOf(today) === month;
  /** Tanggal bawaan untuk item baru: hari ini, atau awal bulan yang sedang dilihat. */
  const defaultDay = isCurrentMonth ? today : firstDayOfMonth(month);
  const hasAnything = data.events.length > 0 || data.campaigns.length > 0;

  // ───────────── Buka dialog ─────────────

  function openNewEvent(day: DayKey, campaignId: string | null = focus) {
    setDayPop(null);
    setCampaignDraft(null);
    setEventDraft(newEventDraft(day, campaignId));
    setOpenKey((k) => k + 1);
  }

  function openEvent(ev: CalEvent) {
    setDayPop(null);
    setCampaignDraft(null);
    setEventDraft(draftFromEvent(ev));
    setOpenKey((k) => k + 1);
  }

  function openNewCampaign(day: DayKey) {
    setDayPop(null);
    setEventDraft(null);
    setCampaignDraft(newCampaignDraft(day, nextCampaignColor(campaigns.map((c) => c.color))));
    setOpenKey((k) => k + 1);
  }

  function openCampaign(c: CalCampaign) {
    setDayPop(null);
    setEventDraft(null);
    setCampaignDraft(draftFromCampaign(c));
    setOpenKey((k) => k + 1);
  }

  // ───────────── Mutasi ─────────────

  /** Simpan/hapus dari dialog: menunggu hasil, dialog menampilkan status menyimpan. */
  function runSave(run: () => Promise<unknown>, fallback: string): Promise<boolean> {
    return new Promise((resolve) => {
      startSaving(async () => {
        try {
          await run();
          router.refresh();
          resolve(true);
        } catch (err) {
          toast.error(actionErrorMessage(err, fallback));
          resolve(false);
        }
      });
    });
  }

  /** Perubahan langsung di kalender: tampil seketika, kembali sendiri bila gagal. */
  function runOptimistic(apply: () => void, run: () => Promise<unknown>, fallback: string) {
    startMutation(async () => {
      apply();
      try {
        await run();
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, fallback));
      }
    });
  }

  async function saveEvent(payload: EventPayload) {
    const ok = await runSave(
      () => upsertRoomCalendarEvent({ ...payload, viewId }),
      "Aktivitas belum tersimpan. Coba lagi.",
    );
    if (ok) setEventDraft(null);
    return ok;
  }

  async function deleteEvent(id: string) {
    const ok = await runSave(
      () => deleteRoomCalendarEvent(id),
      "Aktivitas belum terhapus. Coba lagi.",
    );
    if (ok) {
      setEventDraft(null);
      toast.success("Aktivitas dihapus.");
    }
    return ok;
  }

  async function saveCampaign(payload: CampaignPayload) {
    const ok = await runSave(
      () => upsertRoomCampaign({ ...payload, viewId }),
      "Campaign belum tersimpan. Coba lagi.",
    );
    if (ok) setCampaignDraft(null);
    return ok;
  }

  async function deleteCampaign(id: string) {
    const ok = await runSave(
      () => deleteRoomCampaign(id),
      "Campaign belum terhapus. Coba lagi.",
    );
    if (ok) {
      setCampaignDraft(null);
      toast.success("Campaign dihapus.");
    }
    return ok;
  }

  function toggleDone(ev: CalEvent, done: boolean) {
    runOptimistic(
      () => patchEvents({ type: "done", id: ev.id, done }),
      () => setRoomCalendarEventDone({ id: ev.id, done }),
      "Status aktivitas belum berubah. Coba lagi.",
    );
  }

  function moveEvent(ev: CalEvent, deltaDays: number) {
    // WIB tidak punya DST, jadi geser hari = geser kelipatan 24 jam.
    const shift = (iso: string) => new Date(new Date(iso).getTime() + deltaDays * DAY_MS);
    const startsAt = shift(ev.startsAt);
    const endsAt = ev.endsAt ? shift(ev.endsAt) : null;
    runOptimistic(
      () =>
        patchEvents({
          type: "move",
          id: ev.id,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt ? endsAt.toISOString() : null,
        }),
      () => moveRoomCalendarEvent({ id: ev.id, startsAt, endsAt }),
      "Aktivitas belum berpindah. Coba lagi.",
    );
  }

  function rescheduleCampaign(c: CalCampaign, startDate: DayKey, endDate: DayKey) {
    runOptimistic(
      () => patchCampaigns({ type: "reschedule", id: c.id, startDate, endDate }),
      () => rescheduleRoomCampaign({ id: c.id, startDate, endDate }),
      "Tanggal campaign belum berubah. Coba lagi.",
    );
  }

  // ───────────── Navigasi ─────────────

  function goToday() {
    setMonth(monthKeyOf(today));
    setJumpNonce((n) => n + 1);
    setDayPop(null);
  }

  function stepMonth(delta: number) {
    setMonth((m) => shiftMonth(m, delta));
    setDayPop(null);
  }

  function toggleHidden(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const focusCampaign = focus ? campaignById.get(focus) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Segmented<CalendarViewMode>
          label="Tampilan kalender"
          value={view}
          onChange={(next) => {
            setDayPop(null);
            updateCalendarPrefs({ view: next });
          }}
          options={[
            { value: "month", label: "Bulan", icon: <LayoutGrid className="size-3.5" aria-hidden /> },
            { value: "timeline", label: "Linimasa", icon: <ChartGantt className="size-3.5" aria-hidden /> },
            { value: "agenda", label: "Agenda", icon: <ListTodo className="size-3.5" aria-hidden /> },
          ]}
        />

        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Bulan sebelumnya"
            onClick={() => stepMonth(-1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <h2 className="min-w-[8.5rem] text-center text-base font-semibold" aria-live="polite">
            {formatMonthLong(month)}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Bulan berikutnya"
            onClick={() => stepMonth(1)}
          >
            <ChevronRight aria-hidden />
          </Button>
          <Button type="button" variant="outline" size="sm" className="ml-1.5" onClick={goToday}>
            Hari ini
          </Button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <CalendarLayersButton
            layers={layers}
            kolAvailable={data.kolPosts !== null}
            contentCount={data.contentPosts.length}
            kolCount={data.kolPosts?.length ?? 0}
            onChange={(next) => updateCalendarPrefs({ layers: next })}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openNewCampaign(defaultDay)}
          >
            Campaign baru
          </Button>
          <Button type="button" size="sm" className="gap-1" onClick={() => openNewEvent(defaultDay)}>
            <Plus className="size-3.5" aria-hidden />
            Tambah aktivitas
          </Button>
        </div>
      </div>

      {focusCampaign || hiddenCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {focusCampaign ? (
            <span className="border-primary/40 bg-primary/10 inline-flex h-7 max-w-full items-center gap-1 rounded-full border pr-1 pl-2.5 font-medium">
              <span className="truncate">Hanya menampilkan {focusCampaign.name}</span>
              <button
                type="button"
                aria-label="Tampilkan semua campaign"
                onClick={() => setFocusId(null)}
                className="hover:bg-primary/15 focus-visible:ring-ring rounded-full p-0.5 outline-none focus-visible:ring-2"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ) : (
            <>
              <span className="text-muted-foreground">
                {hiddenCount} campaign disembunyikan dari kalender.
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setHiddenIds(new Set())}
              >
                Tampilkan semua
              </Button>
            </>
          )}
        </div>
      ) : null}

      {view === "timeline" ? (
        <CalendarTimeline
          month={month}
          today={today}
          jumpNonce={jumpNonce}
          zoom={prefs.zoom}
          campaigns={visibleCampaigns}
          events={visibleEvents}
          progress={progress}
          showMoments={layers.moments}
          showLoose={layers.loose}
          onZoomChange={(zoom) => updateCalendarPrefs({ zoom })}
          onOpenCampaign={openCampaign}
          onOpenEvent={openEvent}
          onReschedule={rescheduleCampaign}
          onNewCampaign={() => openNewCampaign(defaultDay)}
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
          {view === "month" ? (
            <div className="flex min-w-0 flex-col gap-2">
              <CalendarMonth
                month={month}
                today={today}
                campaigns={visibleCampaigns}
                events={visibleEvents}
                contentPosts={contentPosts}
                kolPosts={kolPosts}
                moments={moments}
                campaignById={campaignById}
                selectedDay={dayPop?.day ?? null}
                onSelectDay={(day, anchor) => setDayPop({ day, anchor })}
                onOpenEvent={openEvent}
                onOpenCampaign={openCampaign}
                onMoveEvent={moveEvent}
              />
              <p className="text-muted-foreground text-xs">
                {hasAnything
                  ? "Klik tanggal untuk melihat rinciannya. Seret aktivitas ke tanggal lain untuk menjadwal ulang."
                  : "Kalender ini masih kosong. Klik tanggal mana pun untuk menambah aktivitas atau memulai campaign."}
              </p>
            </div>
          ) : (
            <CalendarAgenda
              month={month}
              today={today}
              campaigns={visibleCampaigns}
              events={visibleEvents}
              contentPosts={contentPosts}
              kolPosts={kolPosts}
              moments={moments}
              campaignById={campaignById}
              hasAnything={hasAnything}
              onOpenEvent={openEvent}
              onToggleDone={toggleDone}
              onOpenCampaign={openCampaign}
              onAddEvent={(day) => openNewEvent(day)}
              onAddCampaign={openNewCampaign}
            />
          )}
          <CalendarRail
            today={today}
            campaigns={campaigns}
            progress={progress}
            memberById={memberById}
            hiddenIds={hiddenIds}
            focusId={focus}
            showMoments={layers.moments}
            onOpenCampaign={openCampaign}
            onNewCampaign={() => openNewCampaign(defaultDay)}
            onToggleHidden={toggleHidden}
            onFocus={setFocusId}
          />
        </div>
      )}

      <DayPopover
        day={dayPop?.day ?? null}
        anchor={dayPop?.anchor ?? null}
        items={dayPopItems}
        moments={dayPopMoments}
        campaignById={campaignById}
        onClose={() => setDayPop(null)}
        onOpenEvent={openEvent}
        onToggleDone={toggleDone}
        onOpenCampaign={openCampaign}
        onAddEvent={(day) => openNewEvent(day)}
        onAddCampaign={openNewCampaign}
      />

      <EventDialog
        draft={eventDraft}
        openKey={openKey}
        campaigns={campaigns}
        saving={saving}
        onClose={() => setEventDraft(null)}
        onSave={saveEvent}
        onDelete={deleteEvent}
      />

      <CampaignSheet
        draft={campaignDraft}
        openKey={openKey}
        members={data.members}
        events={events}
        saving={saving}
        onClose={() => setCampaignDraft(null)}
        onSave={saveCampaign}
        onDelete={deleteCampaign}
        onOpenEvent={openEvent}
        onToggleDone={toggleDone}
        onAddEvent={(c) => openNewEvent(c.startDate, c.id)}
      />
    </div>
  );
}
