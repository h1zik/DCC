"use client";

import { useEffect, useRef, useState } from "react";
import { Track } from "livekit-client";
import {
  CarouselLayout,
  FocusLayout,
  FocusLayoutContainer,
  GridLayout,
  ParticipantTile,
  RoomContext,
  isTrackReference,
  useTracks,
} from "@livekit/components-react";
import { Loader2, PhoneCall, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { RoomChannelView } from "@/lib/room-channels";
import type { VoiceParticipantView } from "@/lib/voice";
import { useVoice } from "./voice-provider";
import { VoiceControlButtons } from "./voice-controls";

function CallStage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  // Fokus manual (klik tile ala Discord); null = otomatis mengikuti screenshare.
  const [focusSid, setFocusSid] = useState<string | null>(null);
  const prevShareSids = useRef<string[]>([]);

  const trackRefs = tracks.filter(isTrackReference);
  const screenShareTracks = trackRefs.filter(
    (t) => t.publication.source === Track.Source.ScreenShare,
  );
  const shareSidsKey = screenShareTracks
    .map((t) => t.publication.trackSid)
    .join(",");
  const focusSidExists =
    focusSid !== null &&
    trackRefs.some((t) => t.publication.trackSid === focusSid);

  useEffect(() => {
    const shareSids = shareSidsKey ? shareSidsKey.split(",") : [];
    // Screenshare yang baru mulai otomatis jadi fokus.
    const newSid = shareSids.find(
      (sid) => !prevShareSids.current.includes(sid),
    );
    prevShareSids.current = shareSids;
    if (newSid) setFocusSid(newSid);
  }, [shareSidsKey]);

  // Bila track yang difokuskan hilang (berhenti share / keluar), fallback
  // otomatis ke screenshare terakhir tanpa perlu mereset state.
  const focusedTrack =
    (focusSidExists
      ? trackRefs.find((t) => t.publication.trackSid === focusSid)
      : undefined) ?? screenShareTracks.at(-1);
  const otherTracks = tracks.filter((t) => t !== focusedTrack);

  if (focusedTrack) {
    return (
      <FocusLayoutContainer>
        <CarouselLayout tracks={otherTracks}>
          <ParticipantTile
            onParticipantClick={(evt) => {
              if (evt.track?.trackSid) setFocusSid(evt.track.trackSid);
            }}
          />
        </CarouselLayout>
        <FocusLayout
          trackRef={focusedTrack}
          onParticipantClick={() => setFocusSid(null)}
        />
      </FocusLayoutContainer>
    );
  }
  return (
    <GridLayout tracks={tracks}>
      <ParticipantTile />
    </GridLayout>
  );
}

/** Laporkan ke provider bahwa panel call aktif sedang terlihat (overlay off). */
function PanelMountedReporter() {
  const { setPanelMounted } = useVoice();
  useEffect(() => {
    setPanelMounted(true);
    return () => setPanelMounted(false);
  }, [setPanelMounted]);
  return null;
}

function ParticipantAvatar({
  participant,
  size = "md",
}: {
  participant: VoiceParticipantView;
  size?: "md" | "lg";
}) {
  const cls =
    size === "lg" ? "size-12 text-base" : "size-8 text-[11px] ring-2";
  if (participant.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={participant.image}
        alt={participant.name}
        title={participant.name}
        className={cn("ring-background rounded-full object-cover", cls)}
      />
    );
  }
  return (
    <span
      title={participant.name}
      className={cn(
        "bg-primary/15 text-primary ring-background inline-flex items-center justify-center rounded-full font-semibold uppercase",
        cls,
      )}
    >
      {participant.name.slice(0, 1)}
    </span>
  );
}

/**
 * Panel utama voice channel di halaman chat: grid kamera/screen share saat
 * tersambung, atau layar gabung bila belum. Media dirender lewat RoomContext
 * milik provider global sehingga call tetap hidup di luar panel ini.
 */
export function VoiceCallPanel({
  roomId,
  channel,
  participants,
}: {
  roomId: string;
  channel: RoomChannelView;
  participants: VoiceParticipantView[];
}) {
  const voice = useVoice();
  const isActiveChannel = voice.activeCall?.channelId === channel.id;
  const connectedHere = isActiveChannel && voice.connectionState === "connected";
  const connectingHere =
    isActiveChannel && voice.connectionState === "connecting";

  if (connectedHere && voice.room) {
    return (
      <RoomContext.Provider value={voice.room}>
        <PanelMountedReporter />
        <div
          data-lk-theme="default"
          className="voice-stage from-muted/50 via-background to-background relative flex min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-b"
        >
          <div className="min-h-0 flex-1 overflow-hidden p-2 pb-16">
            <CallStage />
          </div>
          {/* Bar kontrol mengambang ala Discord */}
          <div className="pointer-events-none absolute right-0 bottom-3 left-0 flex justify-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-border bg-card/85 pointer-events-auto rounded-full border px-3 py-2 shadow-2xl backdrop-blur-md"
            >
              <VoiceControlButtons />
            </motion.div>
          </div>
        </div>
      </RoomContext.Provider>
    );
  }

  return (
    <div className="from-muted/50 via-background to-background text-foreground flex min-h-0 flex-1 flex-col items-center justify-center gap-5 bg-gradient-to-b p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <span className="relative inline-flex">
          <span
            className="bg-primary/20 absolute inline-flex size-full animate-ping rounded-full [animation-duration:2.5s]"
            aria-hidden
          />
          <span className="border-primary/20 bg-primary/10 relative inline-flex size-20 items-center justify-center rounded-full border">
            <Volume2 className="text-primary size-9" aria-hidden />
          </span>
        </span>
        <div className="text-center">
          <p className="text-lg font-semibold tracking-tight">{channel.name}</p>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {participants.length > 0
              ? `${participants.length} orang sedang di sini`
              : "Belum ada yang tersambung — jadilah yang pertama!"}
          </p>
        </div>
        {participants.length > 0 ? (
          <div className="flex items-center -space-x-2">
            {participants.slice(0, 6).map((p) => (
              <ParticipantAvatar key={p.userId} participant={p} />
            ))}
            {participants.length > 6 ? (
              <span className="bg-muted text-muted-foreground ring-background inline-flex size-8 items-center justify-center rounded-full text-[11px] font-semibold ring-2">
                +{participants.length - 6}
              </span>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          disabled={connectingHere}
          onClick={() =>
            void voice.join({
              roomId,
              channelId: channel.id,
              channelName: channel.name,
            })
          }
          className="bg-primary text-primary-foreground shadow-primary/25 hover:bg-primary/90 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold shadow-lg transition-all active:scale-95 disabled:opacity-60"
        >
          {connectingHere ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Menyambungkan…
            </>
          ) : (
            <>
              <PhoneCall className="size-4" aria-hidden />
              Gabung Voice
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
}
