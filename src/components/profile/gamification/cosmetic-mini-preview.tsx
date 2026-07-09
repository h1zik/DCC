"use client";

/**
 * Pratinjau animasi down-fidelity untuk swatch kosmetik BERANIMASI (background
 * aurora/bokeh/parallax/shader-flux, border orbit/foil/holographic, nameplate
 * molten). Tujuan: item terkunci tetap tunjukkan "animasi sungguhan" sebagai
 * godaan aspirational — bukan teks statis. Memakai engine yang SAMA dengan
 * halaman profil (CanvasAurora / motion conic-gradient / sheen), hanya diperkecil
 * & di-gate `useAnimationGate` (reduced-motion / off-screen / tab tak terlihat).
 *
 * Kanvas aurora di sini render pada DPR 1 & fewer blobs (down-fidelity) agar
 * banyak swatch bersamaan tidak berat.
 */
import { useRef } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";
import type { BackgroundDescriptor, BorderDescriptor } from "@/lib/gamification/cosmetics";
import { useAnimationGate } from "./use-animation-gate";
import { useThemeColors } from "./theme-sampler";

const CanvasAurora = dynamic(() => import("./canvas-aurora"), { ssr: false });

const THEMED_BASE =
  "linear-gradient(140deg, var(--chart-4) 0%, var(--chart-2) 45%, var(--chart-5) 100%)";

const ORBIT_GRADIENT =
  "conic-gradient(from 0deg, var(--chart-1), var(--chart-2), var(--chart-3), var(--chart-1))";
const FOIL_GRADIENT =
  "conic-gradient(from 0deg, var(--chart-2), var(--chart-4), var(--chart-1), var(--chart-3), var(--chart-2))";

/** Pratinjau mini untuk background beranimasi (down-fidelity aurora). */
export function MiniBackgroundPreview({
  background,
}: {
  background: BackgroundDescriptor;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const needsLive =
    background.effect !== "gradient" && background.effect !== "image";
  const active = useAnimationGate(ref, needsLive);
  const colors = useThemeColors();
  const intensity =
    "params" in background && typeof background.params.intensity === "number"
      ? background.params.intensity
      : 1;

  return (
    <div
      ref={ref}
      className="relative h-12 w-full overflow-hidden rounded-md"
      style={{ background: THEMED_BASE }}
      aria-hidden
    >
      {active && needsLive ? (
        <CanvasAurora colors={colors} intensity={intensity * 0.7} />
      ) : null}
    </div>
  );
}

/** Pratinjau mini untuk avatar border beranimasi (cincin gradient ber-rotasi). */
export function MiniBorderPreview({
  border,
}: {
  border: BorderDescriptor;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const animated = border.effect !== "static-frame";
  const active = useAnimationGate(ref, animated);
  const reduceMotion = useReducedMotion();
  const reduce = reduceMotion || !active;

  const gradient = border.effect === "foil" ? FOIL_GRADIENT : ORBIT_GRADIENT;
  const duration = border.effect === "foil" ? 9 : 6;

  return (
    <div
      ref={ref}
      className="flex h-12 items-center justify-center"
      aria-hidden
    >
      <div className="relative size-9 rounded-full">
        {!animated ? (
          <span
            className="size-full rounded-full border-2"
            style={{
              borderColor: "var(--chart-1)",
              background:
                "color-mix(in oklab, var(--chart-1) 12%, transparent)",
            }}
          />
        ) : (
          <>
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ background: gradient }}
              animate={reduce ? {} : { rotate: 360 }}
              transition={{ duration, repeat: Infinity, ease: "linear" }}
            />
            <span className="absolute inset-[3px] rounded-full bg-muted" />
          </>
        )}
      </div>
    </div>
  );
}

/** Pratinjau mini untuk nameplate beranimasi (sheen sweep). */
export function MiniNameplatePreview({ effect }: { effect: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const animated = effect !== "plain";
  const active = useAnimationGate(ref, animated);
  const reduceMotion = useReducedMotion();
  const reduce = reduceMotion || !active;
  const molten = effect === "molten";
  const base = molten
    ? "linear-gradient(90deg, color-mix(in oklab, var(--chart-4) 85%, black), color-mix(in oklab, var(--chart-1) 80%, transparent), color-mix(in oklab, var(--chart-2) 85%, black))"
    : "color-mix(in oklab, var(--card) 55%, transparent)";

  return (
    <span
      ref={ref}
      className="relative inline-flex h-12 w-full items-center justify-center overflow-hidden"
      aria-hidden
    >
      <span
        className="relative inline-flex items-center overflow-hidden rounded-full border border-white/10 px-2 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm"
        style={{ background: base }}
      >
        {animated && !reduce ? (
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
          />
        ) : null}
        <span className="relative z-10">Aa</span>
      </span>
    </span>
  );
}