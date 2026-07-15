"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Play, Video } from "lucide-react";
import {
  adPosterUrl,
  isAdVideo,
  isRenderableImageUrl,
} from "@/lib/brand-research/ad-library-media";
import type { AdLibraryMediaFields } from "@/lib/brand-research/ad-library-media";
import { cn } from "@/lib/utils";

type AdCreativeMediaProps = {
  ad: AdLibraryMediaFields;
  alt?: string;
  className?: string;
};

export function AdPosterImage({
  src,
  alt,
  onError,
}: {
  src: string;
  alt: string;
  onError?: () => void;
}) {
  return (
    // Native img — fbcdn often blocks Next/Image or requires no-referrer.
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      onError={onError}
    />
  );
}

/** Show first frame of remote video as static preview (Meta rarely ships a separate thumbnail). */
export function VideoFramePoster({
  videoUrl,
  alt,
  onFailed,
}: {
  videoUrl: string;
  alt: string;
  onFailed?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [frameReady, setFrameReady] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset frame preview saat sumber video berganti
    setFrameReady(false);
  }, [videoUrl]);

  return (
    <div className="absolute inset-0 bg-neutral-900">
      {!frameReady ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Video className="text-muted-foreground size-10 animate-pulse" />
        </div>
      ) : null}
      <video
        ref={videoRef}
        src={videoUrl}
        muted
        playsInline
        preload="auto"
        aria-label={alt}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-200",
          frameReady ? "opacity-100" : "opacity-0",
        )}
        onLoadedData={() => {
          const el = videoRef.current;
          if (!el) return;
          try {
            const target = Number.isFinite(el.duration)
              ? Math.min(0.15, Math.max(0, el.duration * 0.02))
              : 0.1;
            if (el.currentTime !== target) {
              el.currentTime = target;
            } else {
              setFrameReady(true);
            }
          } catch {
            setFrameReady(true);
          }
        }}
        onSeeked={() => setFrameReady(true)}
        onError={() => onFailed?.()}
      />
    </div>
  );
}

export function AdCreativeMedia({ ad, alt = "Ad creative", className }: AdCreativeMediaProps) {
  const [playing, setPlaying] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  const poster = adPosterUrl(ad);
  const hasVideo = isAdVideo(ad) && Boolean(ad.videoUrl?.trim());
  const showPosterImage = Boolean(poster) && !posterFailed;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset state playback saat kreatif berganti
    setPlaying(false);
    setVideoFailed(false);
    setPosterFailed(false);
  }, [ad.imageUrl, ad.videoUrl, ad.snapshotUrl, ad.mediaType]);

  if (hasVideo && !videoFailed && !playing) {
    return (
      <div className={cn("relative h-full w-full overflow-hidden", className)}>
        {showPosterImage ? (
          <AdPosterImage
            src={poster!}
            alt={alt}
            onError={() => setPosterFailed(true)}
          />
        ) : (
          <VideoFramePoster
            videoUrl={ad.videoUrl!}
            alt={alt}
            onFailed={() => setPosterFailed(true)}
          />
        )}
        <button
          type="button"
          className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-t from-black/40 via-black/10 to-transparent transition-colors hover:from-black/50 hover:via-black/20 motion-reduce:transition-none"
          aria-label="Putar video iklan"
          onClick={() => setPlaying(true)}
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-black/55 text-white shadow-lg ring-1 ring-white/25 backdrop-blur-sm transition-transform duration-200 hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100">
            <Play className="size-6 fill-current" />
          </span>
        </button>
      </div>
    );
  }

  if (hasVideo && !videoFailed && playing) {
    return (
      <div className={cn("relative h-full w-full overflow-hidden bg-black", className)}>
        <video
          key={ad.videoUrl}
          src={ad.videoUrl!}
          controls
          autoPlay
          playsInline
          preload="auto"
          className="h-full w-full object-contain"
          onError={() => {
            setVideoFailed(true);
            setPlaying(false);
          }}
        />
      </div>
    );
  }

  if (hasVideo && videoFailed) {
    return (
      <div
        className={cn(
          "text-muted-foreground relative flex h-full flex-col items-center justify-center gap-2 overflow-hidden bg-muted p-3 text-center",
          className,
        )}
      >
        {showPosterImage ? (
          <AdPosterImage src={poster!} alt={alt} />
        ) : ad.videoUrl ? (
          <VideoFramePoster videoUrl={ad.videoUrl} alt={alt} />
        ) : (
          <Video className="size-8" />
        )}
        <span className="relative z-10 text-xs">Video tidak bisa diputar di browser ini.</span>
        {ad.videoUrl ? (
          <a
            href={ad.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary relative z-10 text-xs font-medium hover:underline"
          >
            Buka video
          </a>
        ) : null}
      </div>
    );
  }

  if (poster && isRenderableImageUrl(poster)) {
    return (
      <div className={cn("relative h-full w-full overflow-hidden", className)}>
        <AdPosterImage src={poster} alt={alt} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "text-muted-foreground flex h-full items-center justify-center bg-muted",
        className,
      )}
    >
      <ImageIcon className="size-8" />
    </div>
  );
}
