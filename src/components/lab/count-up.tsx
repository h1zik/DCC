"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

/** Angka stat dengan animasi count-up (statis saat prefers-reduced-motion). */
export function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (reduce || !node || value === 0) return;
    const controls = animate(0, value, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        node.textContent = Math.round(v).toLocaleString("id-ID");
      },
    });
    return () => controls.stop();
  }, [value, reduce]);

  return <span ref={ref}>{value.toLocaleString("id-ID")}</span>;
}
