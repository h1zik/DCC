"use client";

import { useEffect, useState } from "react";
import { ConnectionQuality, ConnectionState } from "livekit-client";
import {
  useConnectionQualityIndicator,
  useConnectionState,
  useLocalParticipant,
  useParticipants,
} from "@livekit/components-react";
import { Loader2, Signal, SignalLow, SignalMedium, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceEvents } from "./voice-events-store";

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function CallDuration() {
  const startedAt = useVoiceEvents((s) => s.startedAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!startedAt) return null;
  return (
    <span className="tabular-nums" aria-label="Durasi call">
      {formatDuration((now - startedAt) / 1000)}
    </span>
  );
}

const QUALITY_VIEW: Record<
  ConnectionQuality,
  { label: string; tone: string; Icon: typeof Signal }
> = {
  [ConnectionQuality.Excellent]: {
    label: "Koneksi bagus",
    tone: "text-success",
    Icon: Signal,
  },
  [ConnectionQuality.Good]: {
    label: "Koneksi cukup",
    tone: "text-warning",
    Icon: SignalMedium,
  },
  [ConnectionQuality.Poor]: {
    label: "Koneksi lemah",
    tone: "text-destructive",
    Icon: SignalLow,
  },
  [ConnectionQuality.Lost]: {
    label: "Koneksi terputus",
    tone: "text-destructive",
    Icon: WifiOff,
  },
  [ConnectionQuality.Unknown]: {
    label: "Mengukur koneksi…",
    tone: "text-muted-foreground",
    Icon: SignalLow,
  },
};

/**
 * Strip status di atas stage: durasi, jumlah orang, kualitas koneksi sendiri,
 * dan peringatan saat LiveKit sedang menyambung ulang.
 */
export function VoiceCallStatus({ className }: { className?: string }) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const { quality } = useConnectionQualityIndicator({
    participant: localParticipant,
  });
  const connection = useConnectionState();
  const reconnecting =
    connection === ConnectionState.Reconnecting ||
    connection === ConnectionState.SignalReconnecting;
  const view = QUALITY_VIEW[quality] ?? QUALITY_VIEW[ConnectionQuality.Unknown];

  return (
    <div
      className={cn(
        "text-muted-foreground flex items-center gap-3 px-3 pt-2 text-xs",
        className,
      )}
    >
      <span className="text-foreground inline-flex items-center gap-1.5 font-medium">
        <span className="bg-success size-1.5 rounded-full" aria-hidden />
        <CallDuration />
      </span>
      <span>{participants.length} orang</span>
      {reconnecting ? (
        <span
          role="status"
          className="bg-warning/15 text-warning inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium"
        >
          <Loader2 className="size-3 animate-spin" aria-hidden />
          Menyambungkan ulang…
        </span>
      ) : null}
      <span
        className={cn("ml-auto inline-flex items-center gap-1", view.tone)}
        title={view.label}
      >
        <view.Icon className="size-3.5" aria-hidden />
        <span className="max-sm:sr-only">{view.label}</span>
      </span>
    </div>
  );
}
