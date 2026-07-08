"use client";

/**
 * Preferensi animasi profil (per-perangkat, localStorage). Melengkapi
 * `prefers-reduced-motion`: viewer bisa mematikan efek berat untuk hemat baterai.
 * Default ON. Sinkron antar tab/komponen via event "storage" + custom event.
 */
import { useEffect, useState } from "react";

const KEY = "dcc:profile-animations";
const EVENT = "dcc:profile-animations-change";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function useAnimationsPref(): [boolean, (value: boolean) => void] {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    // Baca awal via rAF (async, bukan setState sinkron di body effect).
    const id = requestAnimationFrame(() => setEnabled(read()));
    const sync = () => setEnabled(read());
    window.addEventListener("storage", sync);
    window.addEventListener(EVENT, sync);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("storage", sync);
      window.removeEventListener(EVENT, sync);
    };
  }, []);

  const set = (value: boolean) => {
    setEnabled(value);
    try {
      localStorage.setItem(KEY, value ? "1" : "0");
      window.dispatchEvent(new Event(EVENT));
    } catch {
      /* ignore */
    }
  };

  return [enabled, set];
}
