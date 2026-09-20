"use client";

import { useState } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import {
  Hand,
  HeadphoneOff,
  Headphones,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useVoice } from "./voice-provider";
import { toggleMicrophone } from "./use-voice-settings";
import { sendVoiceEvent, useVoiceEvents } from "./voice-events-store";
import { VoiceReactionPicker } from "./voice-reactions";
import { VoiceSettingsMenu } from "./voice-settings-menu";
import { VoiceSoundboard } from "./voice-soundboard";

function supportsScreenShare(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function"
  );
}

/**
 * Kelas tombol bundar kontrol call — dipakai ControlButton di sini dan
 * PopoverTrigger di voice-settings-menu agar gayanya identik.
 */
export function controlButtonClassName({
  active,
  danger,
  compact,
}: {
  active?: boolean;
  danger?: boolean;
  compact?: boolean;
}): string {
  return cn(
    "focus-visible:ring-ring inline-flex shrink-0 items-center justify-center rounded-full transition-all duration-150 focus-visible:ring-2 focus-visible:outline-none active:scale-95 disabled:opacity-50",
    compact
      ? "size-8 [&_svg]:size-3.5"
      : "size-10 max-sm:size-8 [&_svg]:size-4.5 max-sm:[&_svg]:size-3.5",
    danger
      ? "bg-destructive shadow-destructive/30 text-white shadow-md hover:opacity-90"
      : active
        ? "bg-primary text-primary-foreground shadow-primary/25 shadow-md hover:opacity-90"
        : "bg-muted text-foreground hover:bg-accent hover:text-accent-foreground",
  );
}

function ControlButton({
  label,
  active,
  danger,
  compact,
  disabled,
  onClick,
  children,
}: {
  label: string;
  /** Tombol dalam keadaan "menyala" (mis. kamera aktif). */
  active?: boolean;
  /** Gaya merah permanen (hangup) atau saat aktif (mic off / tuli). */
  danger?: boolean;
  compact?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={controlButtonClassName({ active, danger, compact })}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <span className="bg-border mx-0.5 h-5 w-px shrink-0 max-sm:hidden" aria-hidden />
  );
}

/**
 * Deret tombol kontrol call ala Discord: media (mic / kamera / share screen /
 * tuli), interaksi (angkat tangan / reaksi / soundboard), lalu pengaturan dan
 * keluar. Mode compact (overlay mengambang) hanya membawa soundboard dari
 * kelompok interaksi. Harus dirender di dalam RoomContext LiveKit.
 */
export function VoiceControlButtons({
  compact,
  onLeave,
  className,
}: {
  compact?: boolean;
  onLeave?: () => void;
  className?: string;
}) {
  const { leave, deafened, setDeafened } = useVoice();
  const room = useRoomContext();
  const {
    localParticipant,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
  } = useLocalParticipant();
  const [busy, setBusy] = useState(false);
  const handRaised = useVoiceEvents(
    (s) => localParticipant.identity in s.hands,
  );

  async function run(action: () => Promise<unknown>, failMessage: string) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      toast.error(
        name === "NotAllowedError"
          ? "Izin ditolak oleh browser — periksa izin situs untuk mic/kamera/layar."
          : failMessage,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "flex items-center",
        compact ? "gap-1.5" : "gap-2 max-sm:gap-1",
        className,
      )}
    >
      <ControlButton
        label={
          isMicrophoneEnabled
            ? "Matikan mic (Ctrl+Shift+M)"
            : "Nyalakan mic (Ctrl+Shift+M)"
        }
        danger={!isMicrophoneEnabled}
        compact={compact}
        disabled={busy}
        onClick={() =>
          void run(
            () => toggleMicrophone(localParticipant),
            "Gagal mengubah status mic.",
          )
        }
      >
        {isMicrophoneEnabled ? <Mic aria-hidden /> : <MicOff aria-hidden />}
      </ControlButton>
      <ControlButton
        label={isCameraEnabled ? "Matikan kamera" : "Nyalakan kamera"}
        active={isCameraEnabled}
        compact={compact}
        disabled={busy}
        onClick={() =>
          void run(
            () => localParticipant.setCameraEnabled(!isCameraEnabled),
            "Gagal mengubah status kamera.",
          )
        }
      >
        {isCameraEnabled ? <Video aria-hidden /> : <VideoOff aria-hidden />}
      </ControlButton>
      {supportsScreenShare() ? (
        <ControlButton
          label={isScreenShareEnabled ? "Berhenti share screen" : "Share screen"}
          active={isScreenShareEnabled}
          compact={compact}
          disabled={busy}
          onClick={() =>
            void run(
              () =>
                localParticipant.setScreenShareEnabled(!isScreenShareEnabled),
              "Gagal memulai share screen.",
            )
          }
        >
          <MonitorUp aria-hidden />
        </ControlButton>
      ) : null}
      <ControlButton
        label={
          deafened
            ? "Buka tuli (Ctrl+Shift+D)"
            : "Tuli — senyapkan audio masuk (Ctrl+Shift+D)"
        }
        danger={deafened}
        compact={compact}
        onClick={() => setDeafened(!deafened)}
      >
        {deafened ? <HeadphoneOff aria-hidden /> : <Headphones aria-hidden />}
      </ControlButton>
      <Divider />
      {compact ? null : (
        <>
          <ControlButton
            label={handRaised ? "Turunkan tangan" : "Angkat tangan"}
            active={handRaised}
            onClick={() =>
              void sendVoiceEvent(room, { t: "hand", up: !handRaised })
            }
          >
            <Hand aria-hidden />
          </ControlButton>
          <VoiceReactionPicker />
        </>
      )}
      <VoiceSoundboard compact={compact} />
      <Divider />
      <VoiceSettingsMenu compact={compact} />
      <ControlButton
        label="Keluar dari voice"
        danger
        compact={compact}
        onClick={() => (onLeave ? onLeave() : void leave())}
      >
        <PhoneOff aria-hidden />
      </ControlButton>
    </div>
  );
}
