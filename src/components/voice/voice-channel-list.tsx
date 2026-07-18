"use client";

import { MicOff, MonitorUp, Video, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoomChannelView } from "@/lib/room-channels";
import type {
  VoiceParticipantView,
  VoiceParticipantsByChannel,
} from "@/lib/voice";
import { useVoice } from "./voice-provider";

function ParticipantRow({ participant }: { participant: VoiceParticipantView }) {
  return (
    <div className="text-muted-foreground flex items-center gap-1.5 py-0.5 pr-2 pl-7 text-xs">
      {participant.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={participant.image}
          alt=""
          className="size-4 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="bg-muted text-foreground/70 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold uppercase">
          {participant.name.slice(0, 1)}
        </span>
      )}
      <span className="truncate">{participant.name}</span>
      <span className="ml-auto flex shrink-0 items-center gap-1">
        {participant.isScreenSharing ? (
          <MonitorUp className="text-primary size-3" aria-label="Share screen" />
        ) : null}
        {participant.isCameraOn ? (
          <Video className="size-3" aria-label="Kamera aktif" />
        ) : null}
        {participant.isMicMuted ? (
          <MicOff className="size-3 opacity-60" aria-label="Mic mati" />
        ) : null}
      </span>
    </div>
  );
}

/**
 * Seksi "Voice" pada sidebar channel: daftar voice channel + siapa yang sedang
 * tersambung (dari polling participants). Klik channel = gabung + buka panel.
 */
export function VoiceChannelList({
  channels,
  participantsByChannel,
  viewedChannelId,
  onOpen,
  renderManageMenu,
}: {
  channels: RoomChannelView[];
  participantsByChannel: VoiceParticipantsByChannel;
  viewedChannelId: string | null;
  onOpen: (channel: RoomChannelView) => void;
  renderManageMenu?: (channel: RoomChannelView) => React.ReactNode;
}) {
  const { activeCall, connectionState } = useVoice();
  if (channels.length === 0) return null;

  return (
    <>
      <div className="mt-2 flex items-center px-1.5 py-1 max-md:hidden">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          Voice
        </span>
      </div>
      {channels.map((channel) => {
        const participants = participantsByChannel[channel.id] ?? [];
        const connectedHere =
          channel.id === activeCall?.channelId &&
          connectionState !== "disconnected";
        const viewing = channel.id === viewedChannelId;
        return (
          <div key={channel.id} className="shrink-0">
            <div
              className={cn(
                "group/channel relative flex items-center rounded-lg transition-colors",
                viewing
                  ? "bg-primary/12 text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {viewing ? (
                <span
                  className="bg-primary absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full"
                  aria-hidden
                />
              ) : null}
              <button
                type="button"
                onClick={() => onOpen(channel)}
                className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-sm"
                title={channel.topic ?? channel.name}
              >
                <span className="relative inline-flex shrink-0">
                  {connectedHere ? (
                    <span
                      className="bg-success/30 absolute inline-flex size-full animate-ping rounded-full [animation-duration:2s]"
                      aria-hidden
                    />
                  ) : null}
                  <Volume2
                    className={cn(
                      "relative size-4",
                      connectedHere ? "text-success" : "opacity-70",
                    )}
                    aria-hidden
                  />
                </span>
                <span className={cn("truncate", viewing && "font-semibold")}>
                  {channel.name}
                </span>
                {participants.length > 0 ? (
                  <span className="bg-success/15 text-success ml-auto inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
                    {participants.length}
                  </span>
                ) : null}
              </button>
              {renderManageMenu ? (
                <span className="mr-1 shrink-0">{renderManageMenu(channel)}</span>
              ) : null}
            </div>
            {participants.length > 0 ? (
              <div className="max-md:hidden">
                {participants.map((p) => (
                  <ParticipantRow key={p.userId} participant={p} />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
