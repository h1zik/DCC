"use client";

/**
 * Latar hero profil. Selalu merender BASE statis (gradien preset lama / gambar
 * unggahan / gradien token tema) — WebGL "hidup" hanya overlay progressive-
 * enhancement yang dimuat lazy & aktif lewat gerbang animasi. Bila WebGL mati/
 * reduced-motion/off-screen, base tetap cakep. Warna WebGL dari token tema.
 */
import dynamic from "next/dynamic";
import { useRef } from "react";
import type { BackgroundDescriptor } from "@/lib/gamification/cosmetics";
import {
  bannerGradientCss,
  isProfileBannerPreset,
} from "@/lib/profile-appearance";
import { cn } from "@/lib/utils";
import { useThemeColors } from "./theme-sampler";
import { useAnimationGate } from "./use-animation-gate";
import { useAnimationsPref } from "./use-animations-pref";

const CanvasAurora = dynamic(() => import("./canvas-aurora"), { ssr: false });

// Base statis bertema untuk efek earned (fully token-based, ikut tema aktif).
const THEMED_BASE =
  "linear-gradient(140deg, var(--chart-4) 0%, var(--chart-2) 45%, var(--chart-5) 100%)";

export function LiveBackground({
  background,
  animate,
  className,
}: {
  background: BackgroundDescriptor;
  /** Override eksplisit (editor). Bila undefined → pakai preferensi viewer. */
  animate?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pref] = useAnimationsPref();
  const enabled = animate ?? pref;
  const needsLiveEffect =
    background.effect !== "gradient" && background.effect !== "image";
  const active = useAnimationGate(ref, enabled && needsLiveEffect);
  const colors = useThemeColors();

  const style: React.CSSProperties = {};
  if (background.effect === "gradient") {
    const preset = "preset" in background ? background.preset : "twilight";
    style.background = bannerGradientCss(
      isProfileBannerPreset(preset) ? preset : "twilight",
    );
  } else if (background.effect === "image") {
    style.backgroundImage = `url(${"url" in background ? background.url : ""})`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
  } else {
    style.background = THEMED_BASE;
  }

  const intensity =
    "params" in background && typeof background.params.intensity === "number"
      ? background.params.intensity
      : 1;

  return (
    <div
      ref={ref}
      className={cn("absolute inset-0", className)}
      style={style}
      aria-hidden
    >
      {active && needsLiveEffect ? (
        <CanvasAurora colors={colors} intensity={intensity} />
      ) : null}
    </div>
  );
}
