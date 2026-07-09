"use client";

/**
 * Gerbang animasi: efek berat (video loop) hanya aktif saat on-screen & tab
 * terlihat. Untuk animated WebP/APNG, parent biasanya bypass gate (murah).
 */
import { useEffect, useState, type RefObject } from "react";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    const id = requestAnimationFrame(update);
    mq.addEventListener?.("change", update);
    return () => {
      cancelAnimationFrame(id);
      mq.removeEventListener?.("change", update);
    };
  }, []);
  return reduced;
}

function isElementVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const vw = window.innerWidth || document.documentElement.clientWidth;
  return rect.bottom > 0 && rect.right > 0 && rect.top < vh && rect.left < vw;
}

export function useAnimationGate(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
): boolean {
  const [onScreen, setOnScreen] = useState(false);
  const [visible, setVisible] = useState(true);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!enabled || reduced) return;
    const el = ref.current;
    if (!el) return;

    // Bootstrap segera — IntersectionObserver pertama bisa telat 1+ frame.
    setOnScreen(isElementVisible(el));

    const io = new IntersectionObserver(
      (entries) => setOnScreen(entries[0]?.isIntersecting ?? false),
      { threshold: 0.01 },
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
