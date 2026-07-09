"use client";

/**
 * Nameplate/banner beranimasi di belakang nama. Sheen bergerak lewat translateX
 * (transform-only, GPU-friendly). Warna dari token tema. Menghormati toggle
 * animasi (editor) & reduced-motion (view).
 */
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { useAnimationsPref } from "./use-animations-pref";

export function Nameplate({
  effect,
  animate,
  className,
  children,
}: {
  effect: string;
  /** Override eksplisit (editor). Undefined → preferensi viewer + reduced-motion. */
  animate?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const [pref] = useAnimationsPref();
  const enabled = animate !== undefined ? animate : pref && !reduceMotion;

  const molten = effect === "molten";
  const isPlain = effect === "plain";
  const base = molten
    ? "linear-gradient(90deg, color-mix(in oklab, var(--chart-4) 85%, black), color-mix(in oklab, var(--chart-1) 80%, transparent), color-mix(in oklab, var(--chart-2) 85%, black))"
    : isPlain
      ? "color-mix(in oklab, var(--card) 75%, transparent)"
      : "color-mix(in oklab, var(--card) 55%, transparent)";

  return (
    <span
      className={cn(
        "relative inline-flex items-center overflow-hidden rounded-full border border-white/10 px-4 py-1 shadow-sm backdrop-blur-sm",
        className,
      )}
      style={{ background: base }}
    >
      {enabled && !isPlain ? (
        <motion.span
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
          }}
          animate={{ x: ["-60%", "460%"] }}
          transition={{
            duration: molten ? 3.4 : 5,
            repeat: Infinity,
            ease: "linear",
          }}
          aria-hidden
        />
      ) : null}
      <span className="relative z-10">{children}</span>
    </span>
  );
}
