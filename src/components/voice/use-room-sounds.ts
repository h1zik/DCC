"use client";

/**
 * Daftar suara kustom soundboard per ruangan — cache modul + subscribe, supaya
 * popover soundboard dan VoiceEventBridge (yang memutar suara masuk) berbagi
 * satu sumber data tanpa React context.
 */
import { useEffect, useSyncExternalStore } from "react";
import type { RoomSoundView } from "@/lib/voice-sounds";
import { pruneCustomSoundCache } from "./sound-engine";

const EMPTY: readonly RoomSoundView[] = [];
const cache = new Map<string, readonly RoomSoundView[]>();
const inflight = new Map<string, Promise<readonly RoomSoundView[]>>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCachedRoomSounds(roomId: string): readonly RoomSoundView[] {
  return cache.get(roomId) ?? EMPTY;
}

/** Ambil ulang daftar suara ruangan; panggilan paralel digabung. */
export function refreshRoomSounds(
  roomId: string,
): Promise<readonly RoomSoundView[]> {
  const pending = inflight.get(roomId);
  if (pending) return pending;
  const request = fetch(`/api/voice/${encodeURIComponent(roomId)}/sounds`, {
    cache: "no-store",
  })
    .then(async (res) => {
      if (!res.ok) return getCachedRoomSounds(roomId);
      const data = (await res.json()) as { sounds?: RoomSoundView[] };
      const sounds = Array.isArray(data.sounds) ? data.sounds : [];
      cache.set(roomId, sounds);
      pruneCustomSoundCache(sounds.map((s) => s.id));
      emit();
      return sounds as readonly RoomSoundView[];
    })
    .catch(() => getCachedRoomSounds(roomId))
    .finally(() => inflight.delete(roomId));
  inflight.set(roomId, request);
  return request;
}

export function useRoomSounds(roomId: string | null): readonly RoomSoundView[] {
  useEffect(() => {
    if (roomId && !cache.has(roomId)) void refreshRoomSounds(roomId);
  }, [roomId]);
  return useSyncExternalStore(
    subscribe,
    () => (roomId ? getCachedRoomSounds(roomId) : EMPTY),
    () => EMPTY,
  );
}
