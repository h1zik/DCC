"use client";

import { useSyncExternalStore } from "react";

/**
 * Preferensi tampilan kalender, diingat per peramban (bukan per akun):
 * tampilan aktif, lapisan yang menyala, dan zoom linimasa.
 */

export type CalendarViewMode = "month" | "timeline" | "agenda";
export type TimelineZoom = "week" | "month" | "quarter";

export type CalendarLayers = {
  /** Tanggal merah, tanggal kembar, periode gajian. */
  moments: boolean;
  /** Jadwal posting dari Content Plan ruangan. */
  content: boolean;
  /** Jadwal tayang KOL brand ruangan. */
  kol: boolean;
  /** Aktivitas yang tidak terkait campaign mana pun. */
  loose: boolean;
};

export type CalendarPrefs = {
  /** null = belum pernah dipilih; ikut ukuran layar. */
  view: CalendarViewMode | null;
  layers: CalendarLayers;
  zoom: TimelineZoom;
};

const KEY = "dcc:room-calendar";

const DEFAULTS: CalendarPrefs = {
  view: null,
  layers: { moments: true, content: true, kol: true, loose: true },
  zoom: "month",
};

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedPrefs: CalendarPrefs = DEFAULTS;

function parse(raw: string | null): CalendarPrefs {
  if (!raw) return DEFAULTS;
  try {
    const v = JSON.parse(raw) as Partial<CalendarPrefs> | null;
    if (!v || typeof v !== "object") return DEFAULTS;
    const view =
      v.view === "month" || v.view === "timeline" || v.view === "agenda" ? v.view : null;
    const zoom =
      v.zoom === "week" || v.zoom === "month" || v.zoom === "quarter" ? v.zoom : DEFAULTS.zoom;
    const layers = { ...DEFAULTS.layers };
    if (v.layers && typeof v.layers === "object") {
      for (const key of Object.keys(layers) as (keyof CalendarLayers)[]) {
        if (typeof v.layers[key] === "boolean") layers[key] = v.layers[key];
      }
    }
    return { view, zoom, layers };
  } catch {
    return DEFAULTS;
  }
}

function read(): CalendarPrefs {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  // Snapshot harus stabil selama isinya sama, kalau tidak React merender ulang terus.
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedPrefs = parse(raw);
  }
  return cachedPrefs;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function updateCalendarPrefs(patch: Partial<CalendarPrefs>) {
  const next = { ...read(), ...patch };
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    /* penyimpanan lokal diblokir: pilihan hanya tidak diingat */
  }
  cachedRaw = raw;
  cachedPrefs = next;
  listeners.forEach((fn) => fn());
}

export function useCalendarPrefs(): CalendarPrefs {
  return useSyncExternalStore(subscribe, read, () => DEFAULTS);
}

const SMALL_SCREEN_QUERY = "(max-width: 767px)";

function subscribeSmallScreen(cb: () => void) {
  const m = window.matchMedia(SMALL_SCREEN_QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

export function useIsSmallScreen(): boolean {
  return useSyncExternalStore(
    subscribeSmallScreen,
    () => window.matchMedia(SMALL_SCREEN_QUERY).matches,
    () => false,
  );
}
