"use client";

/**
 * Player LottieFiles (`.json` / `.lottie`) untuk kosmetik profil.
 * Lazy-load, hormati `active` (pause saat animasi dimatikan), poster fallback.
 */
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { cropStyle, type CosmeticFit } from "./cosmetic-asset-loop";

const DotLottieReact = dynamic(
  () =>
    import("@lottiefiles/dotlottie-react").then((m) => m.DotLottieReact),
  { ssr: false },
);

type DotLottieInstance = {
  play: () => void;
  pause: () => void;
  stop: () => void;
};

const COVER =
  "pointer-events-none absolute inset-0 z-[1] h-full w-full";

export function CosmeticLottiePlayer({
  src,
  poster,
  active,
  focalPoint,
  zoom,
  fit,
  className,
}: {
  src: string;
  poster?: string;
  active: boolean;
  /** `object-position` untuk poster fallback (vektor Lottie mengisi penuh). */
  focalPoint?: string;
  /** Skala zoom untuk poster & vektor. */
  zoom?: number;
  /** `object-fit` untuk poster fallback. */
  fit?: CosmeticFit;
  className?: string;
}) {
  const playerRef = useRef<DotLottieInstance | null>(null);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (active) player.play();
    else player.pause();
  }, [active]);

  if (!active) {
    if (!poster) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={poster}
        alt=""
        className={cn(
          COVER,
          fit === "contain" ? "object-contain" : "object-cover",
          className,
        )}
        style={cropStyle(focalPoint, zoom)}
        aria-hidden
      />
    );
  }

  if (!src) return null;

  return (
    <div
      className={cn(COVER, "overflow-hidden", className)}
      style={cropStyle(focalPoint, zoom)}
      aria-hidden
    >
      <DotLottieReact
        src={src}
        loop
        autoplay
        dotLottieRefCallback={(instance) => {
          playerRef.current = instance;
          if (active) instance?.play();
          else instance?.pause();
        }}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
