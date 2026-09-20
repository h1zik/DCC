"use client";

import { useEffect, useRef } from "react";
import { RoomEvent, type RemoteParticipant } from "livekit-client";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { VOICE_EVENT_TOPIC, decodeVoiceEvent } from "@/lib/voice-events";
import {
  configureSoundEngine,
  playVoiceCue,
  stopSoundboard,
  type VoiceCue,
} from "./sound-engine";
import { refreshRoomSounds } from "./use-room-sounds";
import {
  readVoiceSettings,
  toggleMicrophone,
  useVoiceSettings,
} from "./use-voice-settings";
import {
  applyVoiceEvent,
  forgetVoiceParticipant,
  markVoiceSessionStarted,
  resetVoiceEvents,
  sendVoiceEvent,
  setVoiceEventsSession,
  useVoiceEvents,
} from "./voice-events-store";
import { useVoice } from "./voice-provider";

/** Nada mic/tuli tidak dibunyikan selama jeda ini setelah tersambung. */
const CUE_WARMUP_MS = 2500;

function cue(name: VoiceCue) {
  if (readVoiceSettings().cueSounds) playVoiceCue(name);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/**
 * Jembatan event call — hidup selama sesi (di VoiceActiveSession), terlepas
 * dari panel mana yang terlihat: menerima pesan data (soundboard / reaksi /
 * angkat tangan), membunyikan nada isyarat, dan memasang pintasan keyboard.
 */
export function VoiceEventBridge({ deafened }: { deafened: boolean }) {
  const room = useRoomContext();
  const { activeCall, setDeafened } = useVoice();
  const { settings } = useVoiceSettings();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const handRaised = useVoiceEvents(
    (s) => localParticipant.identity in s.hands,
  );
  const roomId = activeCall?.roomId ?? null;
  const mountedAt = useRef(0);

  useEffect(() => {
    mountedAt.current = Date.now();
    markVoiceSessionStarted();
    cue("join");
    return () => {
      setVoiceEventsSession(null);
      stopSoundboard();
      resetVoiceEvents();
    };
  }, []);

  useEffect(() => {
    if (!roomId) return;
    setVoiceEventsSession({ roomId, deafened });
  }, [roomId, deafened]);

  useEffect(() => {
    if (roomId) void refreshRoomSounds(roomId);
  }, [roomId]);

  useEffect(() => {
    configureSoundEngine({
      soundboardVolume: settings.soundboardVolume,
      speakerDeviceId: settings.speakerDeviceId,
    });
  }, [settings.soundboardVolume, settings.speakerDeviceId]);

  useEffect(() => {
    if (deafened || settings.soundboardMuted) stopSoundboard();
  }, [deafened, settings.soundboardMuted]);

  // Nada isyarat mic & tuli — dari perubahan state, jadi berlaku untuk tombol
  // maupun pintasan keyboard.
  const prevMic = useRef(isMicrophoneEnabled);
  useEffect(() => {
    if (prevMic.current === isMicrophoneEnabled) return;
    prevMic.current = isMicrophoneEnabled;
    if (Date.now() - mountedAt.current < CUE_WARMUP_MS) return;
    cue(isMicrophoneEnabled ? "mic-on" : "mic-off");
  }, [isMicrophoneEnabled]);

  const prevDeafened = useRef(deafened);
  useEffect(() => {
    if (prevDeafened.current === deafened) return;
    prevDeafened.current = deafened;
    cue(deafened ? "deafen" : "undeafen");
  }, [deafened]);

  // Ref supaya listener room tidak perlu dipasang ulang tiap state berubah.
  const live = useRef({ handRaised, deafened });
  useEffect(() => {
    live.current = { handRaised, deafened };
  }, [handRaised, deafened]);

  useEffect(() => {
    const onData = (
      payload: Uint8Array,
      participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic !== VOICE_EVENT_TOPIC || !participant) return;
      const event = decodeVoiceEvent(payload);
      if (!event) return;
      applyVoiceEvent(
        {
          identity: participant.identity,
          name: participant.name || participant.identity,
          isLocal: false,
        },
        event,
      );
    };
    const onJoined = (participant: RemoteParticipant) => {
      if (!live.current.deafened) cue("join");
      // Peserta baru tidak melihat riwayat — kirim ulang tangan yang terangkat.
      if (live.current.handRaised) {
        void sendVoiceEvent(
          room,
          { t: "hand", up: true },
          { destinationIdentities: [participant.identity], echo: false },
        );
      }
    };
    const onLeft = (participant: RemoteParticipant) => {
      if (!live.current.deafened) cue("leave");
      forgetVoiceParticipant(participant.identity);
    };
    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.ParticipantConnected, onJoined);
    room.on(RoomEvent.ParticipantDisconnected, onLeft);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.ParticipantConnected, onJoined);
      room.off(RoomEvent.ParticipantDisconnected, onLeft);
    };
  }, [room]);

  // Pintasan: Ctrl/⌘+Shift+M = mic, Ctrl/⌘+Shift+D = tuli.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey || e.repeat) {
        return;
      }
      if (e.code !== "KeyM" && e.code !== "KeyD") return;
      // Editor teks punya pintasannya sendiri (mis. Ctrl+Shift+M di tiptap).
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      if (e.code === "KeyM") {
        void toggleMicrophone(room.localParticipant).catch(() => undefined);
      } else {
        setDeafened(!live.current.deafened);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [room, setDeafened]);

  return null;
}
