"use client";

import "@livekit/components-styles";
import { useEffect } from "react";
import type { Room } from "livekit-client";
import {
  RoomAudioRenderer,
  RoomContext,
  useRemoteParticipants,
} from "@livekit/components-react";
import { VoiceFloatingOverlay } from "./voice-floating-overlay";
import { useVoiceSettings } from "./use-voice-settings";

/**
 * UI sesi call aktif — dimuat dinamis oleh VoiceProvider HANYA saat ada call,
 * supaya runtime LiveKit (+CSS-nya) tidak ikut bundle setiap halaman dashboard.
 */
export default function VoiceActiveSession({
  room,
  deafened,
  showOverlay,
}: {
  room: Room;
  deafened: boolean;
  showOverlay: boolean;
}) {
  return (
    <RoomContext.Provider value={room}>
      <RoomAudioRenderer muted={deafened} />
      <VoiceVolumeApplier />
      {showOverlay ? <VoiceFloatingOverlay /> : null}
    </RoomContext.Provider>
  );
}

/**
 * Menerapkan volume per-partisipan dari settings ke LiveKit. `setVolume`
 * tersimpan di volumeMap internal — aman dipanggil sebelum track audio tiba,
 * dan diterapkan ulang tiap (re)subscribe. Satu-satunya jalur tulis volume.
 */
function VoiceVolumeApplier() {
  const { settings } = useVoiceSettings();
  const participants = useRemoteParticipants();
  useEffect(() => {
    for (const p of participants) {
      p.setVolume(settings.volumes[p.identity] ?? 1);
    }
  }, [participants, settings.volumes]);
  return null;
}
