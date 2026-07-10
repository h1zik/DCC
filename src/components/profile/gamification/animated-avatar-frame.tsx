"use client";

/**
 * Frame avatar. Static-frame ikut `--profile-accent`; frame CSS beranimasi
 * (orbit-glow/foil/aurora/ember/… — katalog di `frame-styles.ts`) = cincin
 * conic ber-rotasi + opsi glow-pulse & hue-cycle; earned premium `asset-frame`
 * = overlay animated WebP/APNG kurasi (ala Steam).
 */
import { useReducedMotion } from "motion/react";
import type { BorderDescriptor } from "@/lib/gamification/cosmetics";
import { getCssFrameSpec } from "@/lib/gamification/frame-styles";
import { cn } from "@/lib/utils";
import { useAnimationsPref } from "./use-animations-pref";

const STATIC_EFFECTS = new Set(["static-frame"]);

function ringColor(border: BorderDescriptor): string {
  if (border.effect === "static-frame" && "color" in border && border.color) {
    return border.color;
  }
  return "var(--profile-accent)";
}

function AssetFrameOverlay({
  src,
  poster,
  active,
  scale,
  offsetX,
  offsetY,
}: {
  src: string;
  poster?: string;
  active: boolean;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}) {
  const show = active ? src : (poster ?? src);
  const frameScale = Math.max(0.9, Math.min(2, scale ?? 1.28));
  const size = `${Math.round(frameScale * 100)}%`;
  const x = Number.isFinite(offsetX) ? offsetX : 0;
  const y = Number.isFinite(offsetY) ? offsetY : 0;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={show}
        alt=""
        className="absolute max-w-none -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_8px_28px_rgba(0,0,0,0.45)]"
        style={{
          left: `calc(50% + ${x}%)`,
          top: `calc(50% + ${y}%)`,
          width: size,
          height: size,
        }}
        decoding="async"
      />
    </div>
  );
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

  if (border.effect === "asset-frame") {
    return (
      <div className={cn("relative rounded-full shadow-2xl")}>
        <AssetFrameOverlay
          src={border.src}
          poster={border.poster}
          scale={border.scale}
          offsetX={border.offsetX}
          offsetY={border.offsetY}
          active={!reduce}
        />
        <div className="relative rounded-full">{children}</div>
      </div>
    );
  }

  // Frame CSS beranimasi (orbit-glow / foil / aurora / ember / … dari katalog).
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
      aria-hidden
    />
  );

  return (
    <div
      className="relative rounded-full shadow-2xl"
      style={{ padding: spec.thickness ?? 3 }}
    >
      {spec.hueCycle && !reduce ? (
        <div className="profile-avatar-frame-hue absolute inset-0 rounded-full">
          {ring}
        </div>
      ) : (
        ring
      )}
      {spec.pulse && !reduce ? (
        <div
          className="profile-avatar-frame-pulse pointer-events-none absolute inset-0 rounded-full"
          style={{
            boxShadow: `0 0 20px 3px color-mix(in oklab, ${spec.halo} 70%, transparent)`,
          }}
          aria-hidden
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          boxShadow: `0 0 0 4px color-mix(in oklab, ${spec.halo} 14%, transparent), 0 18px 55px -12px color-mix(in oklab, ${spec.halo} 60%, transparent)`,
        }}
        aria-hidden
      />
      <div className="relative rounded-full">{children}</div>
    </div>
  );
}
