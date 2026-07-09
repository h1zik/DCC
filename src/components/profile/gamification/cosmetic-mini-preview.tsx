"use client";

/**
 * Pratinjau animasi down-fidelity untuk swatch kosmetik BERANIMASI.
 * Memakai engine yang sama dengan halaman profil (asset-loop / CSS rotate /
 * sheen), diperkecil & di-gate `useAnimationGate`.
 */
import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { BackgroundDescriptor, BorderDescriptor } from "@/lib/gamification/cosmetics";
import { cn } from "@/lib/utils";
import {
  COSMETIC_BG_ASSETS,
  COSMETIC_BORDER_ASSETS,
  LEGACY_BG_EFFECT_TO_ASSET,
} from "@/lib/gamification/cosmetic-assets";
import { getCssFrameSpec } from "@/lib/gamification/frame-styles";
import { THEMED_BANNER_GRADIENT } from "@/lib/profile-appearance";
import { CosmeticAssetLoop } from "./cosmetic-asset-loop";
import {
  useAnimationGate,
  usePrefersReducedMotion,
} from "./use-animation-gate";
import { useAnimationsPref } from "./use-animations-pref";

const THEMED_BASE = THEMED_BANNER_GRADIENT;

/** Bangun deskriptor background dari `styleConfig` katalog (termasuk legacy). */
export function backgroundFromStyleConfig(
  styleConfig: Record<string, unknown>,
): BackgroundDescriptor | null {
  const effect = String(styleConfig.effect ?? "");
  if (effect === "asset-loop") {
    return {
      effect: "asset-loop",
      src: String(styleConfig.src ?? ""),
      poster: String(styleConfig.poster ?? "") || undefined,
      media: styleConfig.media === "video"
        ? "video"
        : styleConfig.media === "lottie"
          ? "lottie"
          : "image",
      focalPoint: String(styleConfig.focalPoint ?? "") || undefined,
      zoom:
        typeof styleConfig.zoom === "number" && styleConfig.zoom > 0
          ? styleConfig.zoom
          : undefined,
      fit: styleConfig.fit === "contain" ? "contain" : undefined,
    };
  }
  const legacyKey = LEGACY_BG_EFFECT_TO_ASSET[effect];
  if (legacyKey) {
    const a = COSMETIC_BG_ASSETS[legacyKey];
    return {
      effect: "asset-loop",
      src: a.src,
      poster: a.poster,
      media: a.media,
    };
  }
  return null;
}

/** Bangun deskriptor border dari `styleConfig` katalog (termasuk legacy). */
export function borderFromStyleConfig(
  styleConfig: Record<string, unknown>,
): BorderDescriptor | null {
  const effect = String(styleConfig.effect ?? "static-frame");
  if (effect === "static-frame") return null;
  if (effect === "asset-frame") {
    const scaleRaw =
      typeof styleConfig.scale === "number"
        ? styleConfig.scale
        : Number(styleConfig.scale);
    return {
      effect: "asset-frame",
      src: String(styleConfig.src ?? ""),
      poster: String(styleConfig.poster ?? "") || undefined,
      scale: Number.isFinite(scaleRaw) && scaleRaw > 0 ? scaleRaw : undefined,
    };
  }
  if (effect === "holographic") {
    const a = COSMETIC_BORDER_ASSETS.holo;
    return { effect: "asset-frame", src: a.src, poster: a.poster };
  }
  // Sisanya = frame CSS beranimasi (orbit-glow / foil / aurora / ember / …).
  return { effect: "css-frame", frame: effect };
}

/** Pratinjau mini untuk background beranimasi (asset-loop). */
export function MiniBackgroundPreview({
  background,
}: {
  background: BackgroundDescriptor;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pref] = useAnimationsPref();
  const reduced = usePrefersReducedMotion();
  const isVideo =
    background.effect === "asset-loop" && background.media === "video";
  const videoOnScreen = useAnimationGate(ref, isVideo);
  const active =
    background.effect === "asset-loop" &&
    pref &&
    !reduced &&
    (!isVideo || videoOnScreen);

  if (background.effect !== "asset-loop") return null;

  // Backdrop tema (samakan dengan LiveBackground): mengisi bar saat `contain`
  // / zoom-out. Aset di-render CosmeticAssetLoop di atasnya.
  const style: React.CSSProperties = {
    backgroundImage: THEMED_BASE,
    backgroundSize: "cover",
  };

  return (
    <div
      ref={ref}
      className="relative h-12 w-full overflow-hidden rounded-md"
      style={style}
      aria-hidden
    >
      <CosmeticAssetLoop
        src={background.src}
        poster={background.poster}
        media={background.media}
        active={active}
        focalPoint={background.focalPoint}
        zoom={background.zoom}
        fit={background.fit}
      />
    </div>
  );
}

/** Pratinjau mini untuk avatar border beranimasi. */
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

  if (border.effect === "asset-frame") {
    const show = !reduce ? border.src : (border.poster ?? border.src);
    const scale = Math.max(0.9, Math.min(2, border.scale ?? 1.36));
    const size = `${Math.round(scale * 100)}%`;
    return (
      <div
        ref={ref}
        className="flex h-12 items-center justify-center"
        aria-hidden
      >
        <div className="relative size-9">
          <span className="absolute inset-[3px] rounded-full bg-muted" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={show}
            alt=""
            className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
            style={{ width: size, height: size }}
            decoding="async"
          />
        </div>
      </div>
    );
  }

  const spec = getCssFrameSpec(
    border.effect === "css-frame" ? border.frame : "orbit-glow",
  );
  const ring = (
    <div
      className={cn(
        "absolute inset-0 rounded-full",
        !reduce && "profile-avatar-frame-spin",
      )}
      style={{
        background: spec.gradient,
        ["--profile-avatar-frame-duration" as string]: `${spec.duration}s`,
        animationDirection: spec.reverse ? "reverse" : undefined,
      }}
    />
  );

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
            {spec.hueCycle && !reduce ? (
              <div className="profile-avatar-frame-hue absolute inset-0 rounded-full">
                {ring}
              </div>
            ) : (
              ring
            )}
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
