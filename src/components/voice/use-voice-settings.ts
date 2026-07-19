"use client";

/**
 * Preferensi audio voice call (per-perangkat, localStorage): device mic/speaker,
 * toggle pemrosesan mic, dan volume per-partisipan (key = identity/userId).
 * Sinkron antar tab/komponen via event "storage" + custom event.
 */
import { useCallback, useEffect, useState } from "react";
import type { AudioCaptureOptions } from "livekit-client";

const KEY = "dcc:voice-settings";
const EVENT = "dcc:voice-settings-change";

export type VoiceSettings = {
  /** DeviceId mikrofon; "" = default browser. */
  micDeviceId: string;
  /** DeviceId output suara; "" = default browser. */
  speakerDeviceId: string;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  /** identity -> volume 0..1; entri absen berarti 1 (100%). */
  volumes: Record<string, number>;
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  micDeviceId: "",
  speakerDeviceId: "",
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  volumes: {},
};

export function readVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_VOICE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<VoiceSettings>;
    return {
      ...DEFAULT_VOICE_SETTINGS,
      ...parsed,
      volumes:
        parsed.volumes && typeof parsed.volumes === "object"
          ? parsed.volumes
          : {},
    };
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
}

export function writeVoiceSettings(patch: Partial<VoiceSettings>): void {
  try {
    const next = { ...readVoiceSettings(), ...patch };
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
}

/** Opsi capture mic dari settings — dipakai Room options & restartTrack. */
export function micCaptureOptions(s: VoiceSettings): AudioCaptureOptions {
  return {
    deviceId: s.micDeviceId || undefined,
    noiseSuppression: s.noiseSuppression,
    echoCancellation: s.echoCancellation,
    autoGainControl: s.autoGainControl,
  };
}

export function useVoiceSettings(): {
  settings: VoiceSettings;
  update: (patch: Partial<VoiceSettings>) => void;
  setParticipantVolume: (identity: string, volume: number) => void;
} {
  const [settings, setSettings] = useState<VoiceSettings>(
    DEFAULT_VOICE_SETTINGS,
  );

  useEffect(() => {
    // Baca awal via rAF (async, bukan setState sinkron di body effect).
    const id = requestAnimationFrame(() => setSettings(readVoiceSettings()));
    const sync = () => setSettings(readVoiceSettings());
    window.addEventListener("storage", sync);
    window.addEventListener(EVENT, sync);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("storage", sync);
      window.removeEventListener(EVENT, sync);
    };
  }, []);

  const update = useCallback((patch: Partial<VoiceSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    writeVoiceSettings(patch);
  }, []);

  const setParticipantVolume = useCallback(
    (identity: string, volume: number) => {
      const clamped = Math.min(1, Math.max(0, volume));
      // Side effect (localStorage + event) di luar updater setState —
      // updater bisa dijalankan React di fase render.
      const volumes = { ...readVoiceSettings().volumes };
      // Volume penuh = default; hapus entrinya supaya map tetap kecil.
      if (clamped >= 1) delete volumes[identity];
      else volumes[identity] = clamped;
      writeVoiceSettings({ volumes });
      setSettings((prev) => ({ ...prev, volumes }));
    },
    [],
  );

  return { settings, update, setParticipantVolume };
}
