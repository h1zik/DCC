"use client";

import { useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Track } from "livekit-client";
import {
  VideoTrack,
  isTrackReference,
  useSpeakingParticipants,
  useTracks,
  type TrackReference,
} from "@livekit/components-react";
import { GripHorizontal, Maximize2, MicOff, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoice } from "./voice-provider";
import { VoiceControlButtons } from "./voice-controls";

/**
 * Pilih track video yang paling menarik untuk PiP:
 * share screen (remote dulu) → kamera remote → kamera sendiri.
 */
function usePipTrack(): TrackReference | null {
  const tracks = useTracks(
    [
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Camera, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  ).filter(isTrackReference);

  return useMemo(() => {
    const score = (t: TrackReference) => {
      const remote = t.participant.isLocal ? 0 : 1;
      const screen = t.publication.source === Track.Source.ScreenShare ? 2 : 0;
      return screen * 2 + remote;
    };
    return (
      [...tracks].sort((a, b) => score(b) - score(a)).find((t) => {
        const pub = t.publication;
        return !pub.isMuted;
      }) ?? null
    );
  }, [tracks]);
}

/**
 * Overlay call mengambang (ala PiP Discord): muncul di pojok kanan-bawah saat
 * panel call besar tidak terlihat, bisa digeser ke mana saja, menampilkan
 * video paling relevan + kontrol call. Dirender di dalam RoomContext provider.
 */
export function VoiceFloatingOverlay() {
  const { activeCall, connectionState, leave } = useVoice();
  const router = useRouter();
  const constraintsRef = useRef<HTMLDivElement>(null);
  const pipTrack = usePipTrack();
  const speakers = useSpeakingParticipants();
  const someoneSpeaking = speakers.length > 0;

  if (!activeCall || connectionState === "disconnected") return null;

  return (
    <div
      ref={constraintsRef}
      className="pointer-events-none fixed inset-3 z-50"
      aria-hidden={false}
    >
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.06}
        dragConstraints={constraintsRef}
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className={cn(
          "pointer-events-auto absolute right-0 bottom-0 w-72 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md transition-shadow",
          "border-border bg-card/95 text-card-foreground",
          someoneSpeaking && "ring-success/70 ring-2",
        )}
      >
        {/* Header: pegangan drag + nama channel + tombol perbesar */}
        <div className="flex cursor-grab items-center gap-2 px-3 pt-2 pb-1 active:cursor-grabbing">
          <GripHorizontal
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
          <p className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-semibold">
            <Volume2
              className={cn(
                "size-3.5 shrink-0",
                connectionState === "connected"
                  ? "text-success"
                  : "text-warning animate-pulse",
              )}
              aria-hidden
            />
            <span className="truncate">{activeCall.channelName}</span>
          </p>
          <button
            type="button"
            className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors"
            aria-label="Buka voice channel"
            title="Buka voice channel"
            onClick={() => router.push(`/room/${activeCall.roomId}/chat`)}
          >
            <Maximize2 className="size-3.5" aria-hidden />
          </button>
        </div>

        {/* Video PiP / placeholder */}
        <div
          className={cn(
            "relative mx-2 aspect-video overflow-hidden rounded-lg",
            pipTrack ? "bg-black" : "bg-muted/40",
          )}
        >
          {pipTrack ? (
            <>
              <VideoTrack
                trackRef={pipTrack}
                className="size-full object-cover"
              />
              <div className="absolute right-0 bottom-0 left-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 pt-4 pb-1">
                <span className="truncate text-[11px] font-medium text-white/90">
                  {pipTrack.participant.name || pipTrack.participant.identity}
                  {pipTrack.participant.isLocal ? " (kamu)" : ""}
                </span>
                {pipTrack.participant.isMicrophoneEnabled ? null : (
                  <MicOff className="size-3 shrink-0 text-white/60" aria-hidden />
                )}
              </div>
            </>
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1.5">
              <span className="relative inline-flex">
                <span
                  className={cn(
                    "bg-success/40 absolute inline-flex size-full rounded-full",
                    someoneSpeaking && "animate-ping",
                  )}
                  aria-hidden
                />
                <span className="bg-success/15 relative inline-flex size-10 items-center justify-center rounded-full">
                  <Volume2 className="text-success size-5" aria-hidden />
                </span>
              </span>
              <p className="text-muted-foreground text-[11px]">
                {connectionState === "connected"
                  ? "Suara tersambung"
                  : "Menyambungkan…"}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center px-2 py-2">
          <VoiceControlButtons compact onLeave={() => void leave()} />
        </div>
      </motion.div>
    </div>
  );
}
