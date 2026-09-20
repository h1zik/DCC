"use client";

/**
 * State interaksi call (reaksi emoji, tangan terangkat, suara soundboard yang
 * sedang berbunyi) sebagai store modul. VoiceActiveSession — tempat listener
 * data channel hidup — adalah sibling dari halaman chat, jadi panel call tidak
 * bisa menerima state ini lewat React context; keduanya membaca store ini.
 */
import { useSyncExternalStore } from "react";
import type { Room } from "livekit-client";
import {
  REACTION_COOLDOWN_MS,
  SOUNDBOARD_COOLDOWN_MS,
  VOICE_EVENT_TOPIC,
  encodeVoiceEvent,
  type VoiceEvent,
} from "@/lib/voice-events";
import { builtinSoundById } from "@/lib/voice-sounds";
import { playSoundboardSound, playVoiceCue } from "./sound-engine";
import { getCachedRoomSounds, refreshRoomSounds } from "./use-room-sounds";
import { readVoiceSettings } from "./use-voice-settings";

export type VoiceReaction = {
  id: number;
  emoji: string;
  name: string;
  /** Posisi horizontal (%) tempat emoji melayang naik. */
  x: number;
};

export type VoicePlayingSound = {
  name: string;
  emoji: string;
  until: number;
};

type VoiceEventsState = {
  reactions: readonly VoiceReaction[];
  hands: Readonly<Record<string, true>>;
  playing: Readonly<Record<string, VoicePlayingSound>>;
  /** Waktu (epoch ms) sesi call ini tersambung; null saat tidak ada call. */
  startedAt: number | null;
};

const INITIAL: VoiceEventsState = {
  reactions: [],
  hands: {},
  playing: {},
  startedAt: null,
};
const REACTION_LIFETIME_MS = 3200;
const MAX_REACTIONS = 24;

let state: VoiceEventsState = INITIAL;
let reactionSeq = 0;
/** Konteks sesi aktif, diisi VoiceEventBridge. */
let session: { roomId: string; deafened: boolean } | null = null;
const lastSoundAt = new Map<string, number>();
const lastReactionAt = new Map<string, number>();
const listeners = new Set<() => void>();

function setState(next: VoiceEventsState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useVoiceEvents<T>(selector: (s: VoiceEventsState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(INITIAL),
  );
}

export function setVoiceEventsSession(
  next: { roomId: string; deafened: boolean } | null,
): void {
  session = next;
}

export function markVoiceSessionStarted(): void {
  setState({ ...state, startedAt: Date.now() });
}

export function resetVoiceEvents(): void {
  lastSoundAt.clear();
  lastReactionAt.clear();
  setState(INITIAL);
}

export function forgetVoiceParticipant(identity: string): void {
  if (!(identity in state.hands) && !(identity in state.playing)) return;
  const hands = { ...state.hands };
  const playing = { ...state.playing };
  delete hands[identity];
  delete playing[identity];
  setState({ ...state, hands, playing });
}

function passesCooldown(
  map: Map<string, number>,
  identity: string,
  cooldownMs: number,
): boolean {
  const now = Date.now();
  // Toleransi jitter jaringan supaya pesan sah yang berdekatan tidak terbuang.
  if (now - (map.get(identity) ?? 0) < cooldownMs - 400) return false;
  map.set(identity, now);
  return true;
}

function markPlaying(
  identity: string,
  sound: Omit<VoicePlayingSound, "until">,
  durationMs: number,
) {
  const until = Date.now() + durationMs;
  setState({
    ...state,
    playing: { ...state.playing, [identity]: { ...sound, until } },
  });
  window.setTimeout(() => {
    if (state.playing[identity]?.until !== until) return;
    const playing = { ...state.playing };
    delete playing[identity];
    setState({ ...state, playing });
  }, durationMs);
}

async function handleSound(identity: string, soundId: string) {
  if (!session) return;
  const { roomId, deafened } = session;
  let sounds = getCachedRoomSounds(roomId);
  if (!builtinSoundById(soundId) && !sounds.some((s) => s.id === soundId)) {
    // Suara kustom yang belum kita kenal (baru diunggah) — muat ulang sekali.
    sounds = await refreshRoomSounds(roomId);
  }
  const builtin = builtinSoundById(soundId);
  const custom = sounds.find((s) => s.id === soundId);
  if (!builtin && !custom) return;

  const silent = deafened || readVoiceSettings().soundboardMuted;
  const info = silent
    ? {
        name: builtin?.name ?? custom!.name,
        emoji: builtin?.emoji ?? custom!.emoji ?? "🔊",
        durationMs: builtin?.durationMs ?? custom!.durationMs,
      }
    : playSoundboardSound(soundId, sounds);
  if (info) markPlaying(identity, info, info.durationMs);
}

/** Terapkan satu event (dari peserta lain, atau gema lokal milik sendiri). */
export function applyVoiceEvent(
  sender: { identity: string; name: string; isLocal: boolean },
  event: VoiceEvent,
): void {
  switch (event.t) {
    case "sound":
      if (!passesCooldown(lastSoundAt, sender.identity, SOUNDBOARD_COOLDOWN_MS)) {
        return;
      }
      void handleSound(sender.identity, event.id);
      return;
    case "react": {
      if (!passesCooldown(lastReactionAt, sender.identity, REACTION_COOLDOWN_MS)) {
        return;
      }
      const reaction: VoiceReaction = {
        id: ++reactionSeq,
        emoji: event.emoji,
        name: sender.isLocal ? "Kamu" : sender.name,
        x: 8 + Math.random() * 84,
      };
      setState({
        ...state,
        reactions: [...state.reactions, reaction].slice(-MAX_REACTIONS),
      });
      window.setTimeout(() => {
        setState({
          ...state,
          reactions: state.reactions.filter((r) => r.id !== reaction.id),
        });
      }, REACTION_LIFETIME_MS);
      return;
    }
    case "hand": {
      const raised = sender.identity in state.hands;
      if (raised === event.up) return;
      const hands = { ...state.hands };
      if (event.up) hands[sender.identity] = true;
      else delete hands[sender.identity];
      setState({ ...state, hands });
      if (event.up && !sender.isLocal && session && !session.deafened) {
        if (readVoiceSettings().cueSounds) playVoiceCue("hand");
      }
      return;
    }
    case "sounds-changed":
      if (session) void refreshRoomSounds(session.roomId);
      return;
  }
}

/**
 * Kirim event ke peserta lain + gema lokal (LiveKit tidak mengirim balik pesan
 * data ke pengirimnya). `destinationIdentities` membatasi penerima.
 */
export async function sendVoiceEvent(
  room: Room,
  event: VoiceEvent,
  options?: { destinationIdentities?: string[]; echo?: boolean },
): Promise<void> {
  const local = room.localParticipant;
  // Pad yang masih cooldown tidak dikirim — penerima toh akan membuangnya.
  if (event.t === "sound" && localSoundCooldownLeft(local.identity) > 0) return;
  if (options?.echo !== false) {
    applyVoiceEvent(
      { identity: local.identity, name: local.name || "Kamu", isLocal: true },
      event,
    );
  }
  try {
    await local.publishData(encodeVoiceEvent(event), {
      reliable: true,
      topic: VOICE_EVENT_TOPIC,
      destinationIdentities: options?.destinationIdentities,
    });
  } catch {
    // Koneksi sedang goyah — event interaksi boleh hilang, jangan ganggu call.
  }
}

/** Sisa cooldown soundboard milik sendiri (ms); 0 = boleh menekan pad. */
export function localSoundCooldownLeft(identity: string): number {
  const elapsed = Date.now() - (lastSoundAt.get(identity) ?? 0);
  return Math.max(0, SOUNDBOARD_COOLDOWN_MS - elapsed);
}
