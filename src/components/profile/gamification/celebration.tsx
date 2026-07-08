"use client";

/**
 * Celebration sekali-jalan (particle burst) saat baru unlock/naik level. Warna
 * dari token tema; hormati reduced-motion (tak menampilkan apa pun). Auto-hilang.
 */
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
];
const N = 28;

export function Celebration({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!active || reduce) return;
    // setState hanya di callback async (bukan sinkron di body effect).
    const t = setTimeout(() => setDismissed(true), 2600);
    return () => clearTimeout(t);
  }, [active, reduce]);

  if (reduce || !active || dismissed) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden"
      aria-hidden
    >
      <motion.span
        className="absolute size-24 rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--chart-1) 40%, transparent), transparent 70%)",
        }}
        initial={{ scale: 0, opacity: 0.8 }}
        animate={{ scale: 3, opacity: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
      {Array.from({ length: N }, (_, i) => {
        const angle = (i / N) * Math.PI * 2;
        const dist = 120 + (i % 5) * 22;
        return (
          <motion.span
            key={i}
            className="absolute size-2 rounded-full"
            style={{ background: COLORS[i % COLORS.length] }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist,
              opacity: 0,
              scale: 0.4,
            }}
            transition={{ duration: 1.4 + (i % 4) * 0.2, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}
