"use client";

import { useEffect, useRef } from "react";

/**
 * `setInterval` yang otomatis berhenti saat tab hidden dan lanjut (plus satu
 * panggilan catch-up) saat kembali visible — supaya poller header/badge tidak
 * membanjiri server dari tab yang ditinggal idle.
 *
 * `intervalMs = null` menonaktifkan polling (callback tidak dipanggil).
 */
export function useVisiblePolling(
  callback: () => void,
  intervalMs: number | null,
  { immediate = false }: { immediate?: boolean } = {},
) {
  const cbRef = useRef(callback);
  const immediateRef = useRef(immediate);

  useEffect(() => {
    cbRef.current = callback;
  });

  useEffect(() => {
    if (intervalMs == null) return;

    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id == null) id = setInterval(() => cbRef.current(), intervalMs);
    };
    const stop = () => {
      if (id != null) {
        clearInterval(id);
        id = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        cbRef.current();
        start();
      }
    };

    if (immediateRef.current) cbRef.current();
    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}
