"use client";

/**
 * Gerbang animasi sesuai Kontrak Animasi: efek berat hanya aktif saat
 * (a) diizinkan, (b) `prefers-reduced-motion` tidak reduce, (c) elemen on-screen
 * (IntersectionObserver), dan (d) tab terlihat (visibilitychange). Semua kondisi
 * gagal → fallback statis (engine tak dijalankan).
 */
import { useEffect, useState, type RefObject } from "react";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    // Set awal via rAF (async) — hindari setState sinkron di body effect.
    const id = requestAnimationFrame(update);
    mq.addEventListener?.("change", update);
    return () => {
      cancelAnimationFrame(id);
      mq.removeEventListener?.("change", update);
    };
  }, []);
  return reduced;
}

export function useAnimationGate(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
): boolean {
  // State di-set HANYA di dalam observer/listener callback (async) — bukan
  // sinkron di body effect — lalu `active` diturunkan saat render.
  const [onScreen, setOnScreen] = useState(false);
  const [visible, setVisible] = useState(true);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!enabled || reduced) return;
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => setOnScreen(entries[0]?.isIntersecting ?? false),
      { threshold: 0.05 },
    );
    io.observe(el);

    const onVisibility = () =>
      setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ref, enabled, reduced]);

  return enabled && !reduced && onScreen && visible;
}
