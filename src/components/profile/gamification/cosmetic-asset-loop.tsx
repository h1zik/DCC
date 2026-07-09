"use client";

/**
 * Loop aset animasi kurasi: WebM, animated WebP, atau Lottie (LottieFiles).
 * Saat animasi dimatikan → poster statis.
 */
import { cn } from "@/lib/utils";
import type { CosmeticAssetMedia } from "@/lib/gamification/cosmetic-assets";
import { CosmeticLottiePlayer } from "./cosmetic-lottie-player";

const BASE = "pointer-events-none absolute inset-0 z-[1] h-full w-full";

export type CosmeticFit = "cover" | "contain";

const fitClass = (fit?: CosmeticFit) =>
  fit === "contain" ? "object-contain" : "object-cover";

/**
 * Style crop bersama (dipakai img/video/poster/lottie + editor admin):
 * `object-position` menaruh baseline crop di `focalPoint`, lalu `scale(zoom)`
 * memperbesar/perkecil dengan titik jangkar yang sama.
 */
export function cropStyle(
  focalPoint?: string,
  zoom?: number,
): React.CSSProperties | undefined {
  const style: React.CSSProperties = {};
  if (focalPoint) {
    style.objectPosition = focalPoint;
    style.transformOrigin = focalPoint;
  }
  if (zoom && zoom !== 1) style.transform = `scale(${zoom})`;
  return Object.keys(style).length ? style : undefined;
}

export function CosmeticAssetLoop({
  src,
  poster,
  media = "image",
  active,
  focalPoint,
  zoom,
  fit,
  className,
}: {
  src: string;
  poster?: string;
  media?: CosmeticAssetMedia;
  active: boolean;
  /** `object-position` — bagian aset yang tampil saat di-crop `object-cover`. */
  focalPoint?: string;
  /** Skala zoom (1 = fit dasar). Diputar dari titik `focalPoint`. */
  zoom?: number;
  /** "cover" (default, bisa terpotong) / "contain" (utuh, ada bar tema). */
  fit?: CosmeticFit;
  className?: string;
}) {
  const cls = cn(BASE, fitClass(fit), className);
  const style = cropStyle(focalPoint, zoom);

  if (media === "lottie") {
    return (
      <CosmeticLottiePlayer
        src={src}
        poster={poster}
        active={active}
        focalPoint={focalPoint}
        zoom={zoom}
        fit={fit}
        className={className}
      />
    );
  }

  if (!active) {
    if (!poster) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={poster}
        alt=""
        className={cls}
        style={style}
        aria-hidden
        decoding="async"
      />
    );
  }

  if (!src) return null;

  if (media === "video") {
    return (
      <video
        key={src}
        src={src}
        poster={poster}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className={cls}
        style={style}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt=""
      className={cls}
      style={style}
      aria-hidden
      decoding="async"
    />
  );
}
