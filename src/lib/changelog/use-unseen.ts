"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  CHANGELOG_ENTRIES,
  LATEST_CHANGELOG_ID,
  countUnseenEntries,
} from "@/lib/changelog/entries";

/** Kunci localStorage penyimpan id entry terakhir yang sudah dilihat pengguna. */
const STORAGE_KEY = "dcc:changelog:last-seen-id";
/** Event in-tab agar komponen lain (mis. badge sidebar) ikut ter-update. */
const SEEN_EVENT = "dcc:changelog:seen";

function readLastSeenId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Tandai semua entry sudah dilihat (set ke entry terbaru). */
export function markChangelogSeen(): void {
  if (typeof window === "undefined" || !LATEST_CHANGELOG_ID) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, LATEST_CHANGELOG_ID);
  } catch {
    // localStorage tak tersedia (mode privasi dll.) — abaikan diam-diam.
  }
  // `storage` event tidak terpicu di tab yang sama, jadi kirim event manual.
  window.dispatchEvent(new Event(SEEN_EVENT));
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SEEN_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SEEN_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Hook badge "What's New".
 * Mengembalikan jumlah entry yang belum dilihat + status.
 *
 * Catatan hidrasi: `useSyncExternalStore` memakai snapshot server (null →
 * 0 unseen) saat render hidrasi lalu beralih ke nilai localStorage setelah
 * commit, jadi tidak ada mismatch SSR/klien tanpa perlu guard `mounted`.
 */
export function useChangelogUnseen(): {
  unseenCount: number;
  hasUnseen: boolean;
  total: number;
} {
  const lastSeenId = useSyncExternalStore(
    subscribe,
    readLastSeenId,
    () => null, // snapshot server: anggap belum ada yang dilihat
  );

  const unseenCount = countUnseenEntries(lastSeenId);
  return {
    unseenCount,
    hasUnseen: unseenCount > 0,
    total: CHANGELOG_ENTRIES.length,
  };
}

/** Versi callback siap pakai untuk menandai sudah dilihat saat halaman dibuka. */
export function useMarkChangelogSeen(): () => void {
  return useCallback(() => markChangelogSeen(), []);
}
