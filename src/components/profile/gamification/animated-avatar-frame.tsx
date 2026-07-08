"use client";

/**
 * Frame avatar. Static-frame (ring/glow/gem/dashed/none atau warna kustom) ikut
 * `--profile-accent`; efek earned (orbit-glow/foil/holographic) = cincin gradient
 * ber-rotasi (transform-only, GPU-friendly) dari token tema. Reduced-motion →
 * cincin statis (tetap cakep).
 */
import { motion, useReducedMotion } from "motion/react";
import type { BorderDescriptor } from "@/lib/gamification/cosmetics";
import { useAnimationsPref } from "./use-animations-pref";

const STATIC_EFFECTS = new Set(["static-frame"]);

const ORBIT_GRADIENT =
  "conic-gradient(from 0deg, var(--chart-1), var(--chart-2), var(--chart-3), var(--chart-1))";
const FOIL_GRADIENT =
  "conic-gradient(from 0deg, var(--chart-2), var(--chart-4), var(--chart-1), var(--chart-3), var(--chart-2))";

function ringColor(border: BorderDescriptor): string {
  if (border.effect === "static-frame" && "color" in border && border.color) {
    return border.color;
  }
  return "var(--profile-accent)";
}

export function ProfileAvatarFrame({
  border,
  children,
  animate,
}: {
  border: BorderDescriptor;
  children: React.ReactNode;
  /** Override eksplisit (editor). Bila undefined → preferensi viewer. */
  animate?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [pref] = useAnimationsPref();
  const reduce = reduceMotion || !(animate ?? pref);

  // ── Static frames (parity dengan tampilan lama) ──
  if (STATIC_EFFECTS.has(border.effect)) {
    const variant =
      "variant" in border && border.variant ? border.variant : "ring";
    const accent = ringColor(border);
    if (variant === "none") {
      return <div className="relative shadow-2xl">{children}</div>;
    }
    if (variant === "dashed") {
      return (
        <div
          className="relative rounded-full p-[3px] shadow-2xl"
          style={{
            background: `repeating-conic-gradient(${accent} 0 6deg, transparent 6deg 14deg)`,
          }}
        >
          {children}
        </div>
      );
    }
    if (variant === "glow") {
      return (
        <div
          className="relative rounded-full p-[3px] shadow-2xl"
          style={{
            background: `linear-gradient(145deg, color-mix(in srgb, ${accent} 95%, white), color-mix(in srgb, ${accent} 30%, transparent))`,
            boxShadow: `0 0 0 5px color-mix(in srgb, ${accent} 16%, transparent), 0 20px 60px -10px color-mix(in srgb, ${accent} 75%, transparent)`,
          }}
        >
          {children}
        </div>
      );
    }
    if (variant === "gem") {
      return (
        <div
          className="relative rounded-full p-[4px] shadow-2xl"
          style={{
            background: `conic-gradient(from 200deg, ${accent}, #ffffffcc, ${accent}, #00000033, ${accent})`,
          }}
        >
          {children}
        </div>
      );
    }
    // ring (default)
    return (
      <div
        className="relative rounded-full p-[3px] shadow-2xl"
        style={{
          background: `linear-gradient(145deg, color-mix(in srgb, ${accent} 95%, white), color-mix(in srgb, ${accent} 40%, transparent))`,
          boxShadow: `0 14px 50px -12px color-mix(in srgb, ${accent} 65%, transparent)`,
        }}
      >
        {children}
      </div>
    );
  }

  // ── Earned animated frames (cincin gradient ber-rotasi) ──
  const gradient = border.effect === "foil" ? FOIL_GRADIENT : ORBIT_GRADIENT;
  const duration = border.effect === "foil" ? 9 : 6;

  return (
    <div className="relative rounded-full p-[3px] shadow-2xl">
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: gradient }}
        animate={reduce ? {} : { rotate: 360 }}
        transition={{ duration, repeat: Infinity, ease: "linear" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          boxShadow:
            "0 0 0 4px color-mix(in oklab, var(--chart-1) 14%, transparent), 0 18px 55px -12px color-mix(in oklab, var(--chart-1) 60%, transparent)",
        }}
        aria-hidden
      />
      <div className="relative rounded-full">{children}</div>
    </div>
  );
}
