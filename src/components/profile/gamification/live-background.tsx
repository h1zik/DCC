"use client";

/**
 * Latar hero profil. Statis (gradien / unggahan) atau earned `asset-loop`
 * (WebM / animated WebP kurasi). Animated WebP diputar saat toggle ON;
 * video loop di-pause off-screen (hemat CPU).
 */
import { useRef } from "react";
import type { BackgroundDescriptor } from "@/lib/gamification/cosmetics";
import { backgroundIsAnimated } from "@/lib/gamification/cosmetics";
import {
  THEMED_BANNER_GRADIENT,
  bannerGradientCss,
  isProfileBannerPreset,
} from "@/lib/profile-appearance";
import { cn } from "@/lib/utils";
import { CosmeticAssetLoop } from "./cosmetic-asset-loop";
import {
  useAnimationGate,
  usePrefersReducedMotion,
} from "./use-animation-gate";
import { useAnimationsPref } from "./use-animations-pref";

const THEMED_BASE = THEMED_BANNER_GRADIENT;

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
  const reduced = usePrefersReducedMotion();
  const enabled = animate ?? pref;
  const needsAnimation = backgroundIsAnimated(background);

  const isVideoLoop =
    background.effect === "asset-loop" && background.media === "video";
  const videoOnScreen = useAnimationGate(
    ref,
    enabled && needsAnimation && isVideoLoop,
  );

  const canAnimate = enabled && !reduced && needsAnimation;
  const active = canAnimate && (!isVideoLoop || videoOnScreen);

  const style: React.CSSProperties = {};
  if (background.effect === "gradient") {
    const preset = "preset" in background ? background.preset : "twilight";
    style.background = bannerGradientCss(
      isProfileBannerPreset(preset) ? preset : "twilight",
    );
  } else if (background.effect === "image") {
    style.backgroundImage = `url(${"url" in background ? background.url : ""})`;
    style.backgroundSize = "cover";
    style.backgroundPosition = background.focalPoint ?? "center";
  } else if (background.effect === "asset-loop") {
    // Backdrop tema di belakang aset — mengisi bar bila di-zoom-out di bawah
    // cover. Aset (img/video/lottie) di-render CosmeticAssetLoop di atasnya.
    // Longhand only (React warning saat `active` toggle menghapus longhand).
    style.backgroundImage = THEMED_BASE;
    style.backgroundSize = "cover";
  }

  return (
    <div
      ref={ref}
      className={cn("absolute inset-0", className)}
      style={style}
      aria-hidden
    >
      {background.effect === "asset-loop" ? (
        <CosmeticAssetLoop
          src={background.src}
          poster={background.poster}
          media={background.media}
          active={active}
          focalPoint={background.focalPoint}
          zoom={background.zoom}
          fit={background.fit}
        />
      ) : null}
    </div>
  );
}
