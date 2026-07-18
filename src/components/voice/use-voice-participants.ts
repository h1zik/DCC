"use client";

import { useCallback, useEffect, useState } from "react";
import {
  VOICE_PARTICIPANTS_POLL_INTERVAL_MS,
  type VoiceParticipantsByChannel,
} from "@/lib/voice";
import { useVoice } from "./voice-provider";

/**
 * Poll daftar peserta voice satu ruangan (untuk sidebar & layar gabung).
 * Refresh cepat sesaat setelah join/leave lewat pollNonce dari provider.
 */
export function useVoiceParticipants(
  roomId: string,
): VoiceParticipantsByChannel {
  const { pollNonce } = useVoice();
  const [participantsByChannel, setParticipantsByChannel] =
    useState<VoiceParticipantsByChannel>({});

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/voice/${roomId}/participants`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        participants?: VoiceParticipantsByChannel;
      };
      setParticipantsByChannel(data.participants ?? {});
    } catch {
      /* transient — poll berikutnya memperbaiki */
    }
  }, [roomId]);

  useEffect(() => {
    const initialId = window.setTimeout(() => void refresh(), 0);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, VOICE_PARTICIPANTS_POLL_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialId);
      window.clearInterval(id);
    };
  }, [refresh]);

  // Join/leave baru saja terjadi — beri jeda sebentar agar LiveKit settle.
  useEffect(() => {
    if (pollNonce === 0) return;
    const id = window.setTimeout(() => void refresh(), 1200);
    return () => window.clearTimeout(id);
  }, [pollNonce, refresh]);

  return participantsByChannel;
}
