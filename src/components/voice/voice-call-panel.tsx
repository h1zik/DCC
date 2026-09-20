"use client";

import { useEffect, useRef, useState } from "react";
import { Track } from "livekit-client";
import {
  CarouselLayout,
  FocusLayoutContainer,
  GridLayout,
  RoomContext,
  isTrackReference,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import {
  Loader2,
  MicOff,
  MonitorUp,
  PhoneCall,
  Video,
  Volume2,
} from "lucide-react";
import { motion } from "motion/react";
import type { RoomChannelView } from "@/lib/room-channels";
import type { VoiceParticipantView } from "@/lib/voice";
import { useVoice } from "./voice-provider";
import { VoiceCallStatus } from "./voice-call-status";
import { VoiceControlButtons } from "./voice-controls";
import { VoiceReactionLayer } from "./voice-reactions";
import { VoiceAvatar, VoiceTile } from "./voice-tile";

/** Kunci fokus stabil per tile — placeholder (tanpa publikasi) pun bisa difokuskan. */
function tileKey(t: TrackReferenceOrPlaceholder): string {
  return `${t.participant.identity}:${t.source}`;
}

function CallStage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  // Fokus manual (klik tile ala Discord); null = otomatis mengikuti screenshare.
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const prevShareKeys = useRef<string[]>([]);

  const screenShareTracks = tracks.filter(
    (t) => isTrackReference(t) && t.source === Track.Source.ScreenShare,
  );
  const shareKeysJoined = screenShareTracks.map(tileKey).join(",");

  useEffect(() => {
    const shareKeys = shareKeysJoined ? shareKeysJoined.split(",") : [];
    // Screenshare yang baru mulai otomatis jadi fokus.
    const newKey = shareKeys.find(
      (key) => !prevShareKeys.current.includes(key),
    );
    prevShareKeys.current = shareKeys;
    if (newKey) setFocusKey(newKey);
  }, [shareKeysJoined]);

  // Bila tile yang difokuskan hilang (berhenti share / keluar), fallback
  // otomatis ke screenshare terakhir tanpa perlu mereset state.
  const focusedTrack =
    (focusKey !== null
      ? tracks.find((t) => tileKey(t) === focusKey)
      : undefined) ?? screenShareTracks.at(-1);
  const otherTracks = tracks.filter((t) => t !== focusedTrack);

  if (focusedTrack) {
    return (
      <FocusLayoutContainer>
        <CarouselLayout tracks={otherTracks}>
          <VoiceTile onSelect={(t) => setFocusKey(tileKey(t))} />
        </CarouselLayout>
        <div className="min-h-0 min-w-0">
          <VoiceTile
            trackRef={focusedTrack}
            onSelect={() => setFocusKey(null)}
            selectLabel="Lepas fokus dari"
            allowFullscreen
          />
        </div>
      </FocusLayoutContainer>
    );
  }
  // Sendirian: tidak ada yang perlu difokuskan.
  const selectable = tracks.length > 1;
  return (
    <GridLayout tracks={tracks}>
      <VoiceTile
        onSelect={selectable ? (t) => setFocusKey(tileKey(t)) : undefined}
      />
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

/** Satu baris "siapa yang sedang di dalam" pada layar gabung. */
function LobbyParticipantRow({
  participant,
}: {
  participant: VoiceParticipantView;
}) {
  return (
    <li className="flex items-center gap-2.5 px-3 py-2">
      <VoiceAvatar
        name={participant.name}
        image={participant.image}
        className="size-7 shrink-0 text-xs"
      />
      <span className="min-w-0 flex-1 truncate text-sm">
        {participant.name}
      </span>
      <span className="text-muted-foreground flex shrink-0 items-center gap-1.5">
        {participant.isScreenSharing ? (
          <MonitorUp
            className="text-primary size-3.5"
            aria-label="Share screen"
          />
        ) : null}
        {participant.isCameraOn ? (
          <Video className="size-3.5" aria-label="Kamera aktif" />
        ) : null}
        {participant.isMicMuted ? (
          <MicOff className="size-3.5 opacity-70" aria-label="Mic mati" />
        ) : null}
      </span>
    </li>
  );
}

/**
 * Panel utama voice channel di halaman chat: stage tile peserta (kamera / share
 * screen / avatar) saat tersambung, atau layar gabung bila belum. Media
 * dirender lewat RoomContext milik provider global sehingga call tetap hidup
 * di luar panel ini.
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
          className="voice-stage bg-background relative flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <VoiceCallStatus />
          <div className="min-h-0 flex-1 overflow-hidden p-1 pb-16">
            <CallStage />
          </div>
          <VoiceReactionLayer />
          {/* Bar kontrol mengambang ala Discord */}
          <div className="pointer-events-none absolute right-0 bottom-3 left-0 flex justify-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-border bg-card/90 pointer-events-auto max-w-[calc(100%-0.75rem)] overflow-x-auto rounded-full border px-3 py-2 shadow-xl backdrop-blur-md max-sm:px-2"
            >
              <VoiceControlButtons />
            </motion.div>
          </div>
        </div>
      </RoomContext.Provider>
    );
  }

  const shown = participants.slice(0, 5);
  return (
    <div className="bg-background text-foreground flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto p-6">
      <div className="flex w-full max-w-xs flex-col items-center gap-5">
        <span className="border-primary/20 bg-primary/10 inline-flex size-16 items-center justify-center rounded-full border">
          <Volume2 className="text-primary size-7" aria-hidden />
        </span>
        <div className="text-center">
          <p className="text-lg font-semibold tracking-tight">{channel.name}</p>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {participants.length > 0
              ? `${participants.length} orang sedang di dalam`
              : "Belum ada siapa-siapa. Masuk duluan, yang lain akan melihatmu di sini."}
          </p>
        </div>
        {shown.length > 0 ? (
          <ul className="border-border bg-card divide-border w-full divide-y rounded-xl border">
            {shown.map((p) => (
              <LobbyParticipantRow key={p.userId} participant={p} />
            ))}
            {participants.length > shown.length ? (
              <li className="text-muted-foreground px-3 py-2 text-xs">
                dan {participants.length - shown.length} orang lainnya
              </li>
            ) : null}
          </ul>
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
          className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95 disabled:opacity-60"
        >
          {connectingHere ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Menyambungkan…
            </>
          ) : (
            <>
              <PhoneCall className="size-4" aria-hidden />
              Gabung voice
            </>
          )}
        </button>
        <p className="text-muted-foreground text-center text-xs">
          Mic langsung menyala saat kamu masuk; kamera tetap mati sampai kamu
          nyalakan.
        </p>
      </div>
    </div>
  );
}
