"use client";

import { useRef } from "react";
import { ConnectionQuality, Track, type Participant } from "livekit-client";
import {
  VideoTrack,
  isTrackReference,
  useConnectionQualityIndicator,
  useIsMuted,
  useIsSpeaking,
  useMaybeTrackRefContext,
  useParticipantInfo,
  useParticipantTracks,
  useTrackVolume,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { Maximize, MicOff, MonitorUp, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceEvents } from "./voice-events-store";

/** Foto profil dari metadata token ({ image }) — lihat mintVoiceToken. */
export function participantImage(metadata: string | undefined): string | null {
  if (!metadata) return null;
  try {
    const meta = JSON.parse(metadata) as { image?: unknown };
    return typeof meta.image === "string" && meta.image ? meta.image : null;
  } catch {
    return null;
  }
}

/** Hue stabil per orang — memberi tiap tile warna dasar yang bisa dikenali. */
function identityHue(identity: string): number {
  let hash = 0;
  for (let i = 0; i < identity.length; i++) {
    hash = (hash * 31 + identity.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

export function VoiceAvatar({
  name,
  image,
  className,
}: {
  name: string;
  image: string | null;
  className?: string;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        draggable={false}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "bg-primary/15 text-primary inline-flex items-center justify-center rounded-full font-semibold uppercase",
        className,
      )}
    >
      {name.slice(0, 1)}
    </span>
  );
}

/**
 * Aura suara: dua cincin di belakang avatar yang membesar mengikuti level audio
 * nyata mic peserta. Dipisah jadi komponen sendiri karena useTrackVolume
 * memicu render ~30×/detik — tile (dan <video>) tidak ikut dirender ulang.
 */
function VoiceAura({ participant }: { participant: Participant }) {
  const [micRef] = useParticipantTracks(
    [Track.Source.Microphone],
    participant.identity,
  );
  const volume = useTrackVolume(micRef);
  // Kurva akar: suara pelan pun terlihat, teriakan tidak meledak.
  const level = micRef && !micRef.publication.isMuted ? Math.sqrt(volume) : 0;
  return (
    <>
      <span
        aria-hidden
        className="voice-aura bg-success/25 absolute inset-0 rounded-full"
        style={{
          transform: `scale(${1 + level * 0.55})`,
          opacity: level > 0.04 ? 1 : 0,
        }}
      />
      <span
        aria-hidden
        className="voice-aura bg-success/45 absolute inset-0 rounded-full"
        style={{
          transform: `scale(${1 + level * 0.25})`,
          opacity: level > 0.04 ? 1 : 0,
        }}
      />
    </>
  );
}

/**
 * Tile satu peserta (kamera / share screen / avatar). Pengganti ParticipantTile
 * bawaan LiveKit; membaca trackRef dari prop atau dari TrackLoop (GridLayout /
 * CarouselLayout).
 */
export function VoiceTile({
  trackRef: trackRefProp,
  onSelect,
  selectLabel,
  allowFullscreen,
  className,
}: {
  trackRef?: TrackReferenceOrPlaceholder;
  /** Klik tile (fokuskan / lepas fokus). */
  onSelect?: (trackRef: TrackReferenceOrPlaceholder) => void;
  selectLabel?: string;
  allowFullscreen?: boolean;
  className?: string;
}) {
  const contextRef = useMaybeTrackRefContext();
  const trackRef = (trackRefProp ?? contextRef) as TrackReferenceOrPlaceholder;
  const participant = trackRef.participant;
  const tileRef = useRef<HTMLDivElement>(null);

  const isScreen = trackRef.source === Track.Source.ScreenShare;
  const videoMuted = useIsMuted(trackRef);
  const micMuted = useIsMuted({
    participant,
    source: Track.Source.Microphone,
  });
  const speaking = useIsSpeaking(participant);
  const { name, identity, metadata } = useParticipantInfo({ participant });
  const { quality } = useConnectionQualityIndicator({ participant });
  const handRaised = useVoiceEvents((s) => participant.identity in s.hands);
  const playing = useVoiceEvents((s) => s.playing[participant.identity]);

  const displayName = name || identity || "Peserta";
  const showVideo = isTrackReference(trackRef) && !videoMuted;
  const weakConnection =
    quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost;

  return (
    <div
      ref={tileRef}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={
        onSelect ? `${selectLabel ?? "Fokuskan"} ${displayName}` : undefined
      }
      onClick={onSelect ? () => onSelect(trackRef) : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(trackRef);
              }
            }
          : undefined
      }
      style={
        showVideo
          ? undefined
          : {
              background: `color-mix(in oklab, hsl(${identityHue(participant.identity)} 65% 50%) 13%, var(--card))`,
            }
      }
      className={cn(
        "voice-tile group/tile border-border/60 focus-visible:ring-ring relative size-full min-h-0 overflow-hidden rounded-xl border [container-type:size] outline-none focus-visible:ring-2",
        showVideo && "bg-black",
        onSelect && "cursor-pointer",
        className,
      )}
    >
      {showVideo ? (
        <VideoTrack
          trackRef={trackRef}
          className={cn(
            "size-full",
            participant.isLocal && !isScreen && "-scale-x-100",
          )}
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <span className="relative inline-flex size-[clamp(2.25rem,34cqmin,7.5rem)]">
            {isScreen ? null : <VoiceAura participant={participant} />}
            <VoiceAvatar
              name={displayName}
              image={participantImage(metadata)}
              className="ring-background/60 relative size-full text-[clamp(0.9rem,13cqmin,2.75rem)] ring-2"
            />
          </span>
        </div>
      )}

      {/* Bingkai "sedang bicara" — penting untuk tile video yang tak punya aura */}
      {isScreen ? null : (
        <span
          aria-hidden
          className={cn(
            "border-success pointer-events-none absolute inset-0 rounded-xl border-2 transition-opacity duration-150",
            speaking && !micMuted ? "opacity-100" : "opacity-0",
          )}
        />
      )}

      <div className="pointer-events-none absolute top-1.5 right-1.5 left-1.5 flex items-start gap-1">
        {handRaised && !isScreen ? (
          <span
            className="voice-hand bg-warning inline-flex size-7 items-center justify-center rounded-full text-base shadow-md"
            role="img"
            aria-label="Angkat tangan"
          >
            ✋
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-1">
          {weakConnection ? (
            <span
              className="bg-background/75 text-destructive inline-flex size-6 items-center justify-center rounded-md backdrop-blur-sm"
              title="Koneksi lemah"
            >
              <WifiOff className="size-3.5" aria-label="Koneksi lemah" />
            </span>
          ) : null}
          {allowFullscreen && showVideo ? (
            <button
              type="button"
              aria-label="Layar penuh"
              title="Layar penuh"
              onClick={(e) => {
                e.stopPropagation();
                if (document.fullscreenElement) void document.exitFullscreen();
                else void tileRef.current?.requestFullscreen().catch(() => {});
              }}
              className="bg-background/75 text-foreground hover:bg-background focus-visible:ring-ring pointer-events-auto inline-flex size-7 items-center justify-center rounded-md opacity-0 backdrop-blur-sm transition-opacity group-hover/tile:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
            >
              <Maximize className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </span>
      </div>

      <div className="pointer-events-none absolute right-1.5 bottom-1.5 left-1.5 flex items-end justify-between gap-1.5">
        <span className="bg-background/75 text-foreground inline-flex max-w-full min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium backdrop-blur-sm">
          {isScreen ? (
            <MonitorUp className="text-primary size-3 shrink-0" aria-hidden />
          ) : micMuted ? (
            <MicOff
              className="text-destructive size-3 shrink-0"
              aria-label="Mic mati"
            />
          ) : null}
          <span className="truncate">
            {isScreen ? `Layar ${displayName}` : displayName}
            {participant.isLocal && !isScreen ? " (kamu)" : ""}
          </span>
        </span>
        {playing && !isScreen ? (
          <span
            key={playing.until}
            className="voice-sound-chip bg-primary text-primary-foreground inline-flex min-w-0 shrink items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium shadow-md"
          >
            <span aria-hidden>{playing.emoji}</span>
            <span className="truncate">{playing.name}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
