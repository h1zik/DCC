"use client";

import { useState } from "react";
import {
  useMediaDeviceSelect,
  useRemoteParticipants,
  useRoomContext,
} from "@livekit/components-react";
import { LocalAudioTrack, Track } from "livekit-client";
import { Settings2, Volume1, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { controlButtonClassName } from "./voice-controls";
import {
  micCaptureOptions,
  readVoiceSettings,
  useVoiceSettings,
  type VoiceSettings,
} from "./use-voice-settings";

function supportsSinkId(): boolean {
  return (
    typeof HTMLAudioElement !== "undefined" &&
    "setSinkId" in HTMLAudioElement.prototype
  );
}

function deviceLabel(device: MediaDeviceInfo, index: number): string {
  return device.label || `Perangkat ${index + 1}`;
}

/** Picker device audio (mic/speaker) — bind ke device aktif LiveKit, bukan
 *  nilai tersimpan, supaya tidak "bohong" saat device tercabut. */
function DeviceSection({
  kind,
  label,
  onPicked,
}: {
  kind: "audioinput" | "audiooutput";
  label: string;
  onPicked: (deviceId: string) => void;
}) {
  const room = useRoomContext();
  const { devices, activeDeviceId, setActiveMediaDevice } =
    useMediaDeviceSelect({ kind, room, requestPermissions: false });

  const items = devices
    .filter((d) => d.deviceId)
    .map((d, i) => ({ value: d.deviceId, label: deviceLabel(d, i) }));
  const activeLabel =
    items.find((i) => i.value === activeDeviceId)?.label ??
    items[0]?.label ??
    "Default";

  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select
        value={activeDeviceId}
        items={items}
        onValueChange={(deviceId) => {
          if (!deviceId || deviceId === activeDeviceId) return;
          void (async () => {
            try {
              await setActiveMediaDevice(deviceId);
              onPicked(deviceId);
            } catch {
              toast.error("Gagal mengganti perangkat audio.");
            }
          })();
        }}
      >
        <SelectTrigger className="w-full text-xs" aria-label={label}>
          <span className="truncate">{activeLabel}</span>
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              <span className="truncate">{item.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ProcessingToggle({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Label htmlFor={id} className="justify-between py-0.5 font-normal">
      {label}
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
    </Label>
  );
}

function volumeIcon(volume: number) {
  if (volume === 0) return <VolumeX aria-hidden />;
  if (volume < 0.5) return <Volume1 aria-hidden />;
  return <Volume2 aria-hidden />;
}

/** Slider volume per-partisipan. Penerapan ke LiveKit dilakukan
 *  VoiceVolumeApplier di provider — di sini hanya tulis settings. */
function ParticipantVolumeList({
  settings,
  setParticipantVolume,
}: {
  settings: VoiceSettings;
  setParticipantVolume: (identity: string, volume: number) => void;
}) {
  const participants = useRemoteParticipants();

  if (participants.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">Belum ada peserta lain.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {participants.map((p) => {
        const volume = settings.volumes[p.identity] ?? 1;
        const percent = Math.round(volume * 100);
        return (
          <div key={p.identity} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-medium">
                {p.name || p.identity}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {percent}%
              </span>
            </div>
            <div className="flex items-center gap-2 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground">
              {volumeIcon(volume)}
              <Slider
                value={percent}
                min={0}
                max={100}
                step={1}
                aria-label={`Volume ${p.name || p.identity}`}
                onValueChange={(value) =>
                  setParticipantVolume(p.identity, value / 100)
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Tombol gear + popover "Pengaturan suara": picker mic/speaker, toggle
 * pemrosesan mic, dan volume per-peserta. Harus dirender di dalam
 * RoomContext LiveKit (dipasang di deret VoiceControlButtons).
 */
export function VoiceSettingsMenu({ compact }: { compact?: boolean }) {
  const room = useRoomContext();
  const { settings, update, setParticipantVolume } = useVoiceSettings();
  const [open, setOpen] = useState(false);

  async function applyProcessing(patch: Partial<VoiceSettings>) {
    update(patch);
    // Track mic aktif → restart dengan constraint baru (blip singkat, wajar).
    // Mic sedang off → opsi dibawa saat enable berikutnya (voice-controls).
    const track = room.localParticipant.getTrackPublication(
      Track.Source.Microphone,
    )?.track;
    if (track instanceof LocalAudioTrack) {
      try {
        await track.restartTrack(micCaptureOptions(readVoiceSettings()));
      } catch {
        toast.error("Gagal menerapkan pengaturan mic.");
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Pengaturan suara"
        title="Pengaturan suara"
        className={controlButtonClassName({ active: open, compact })}
      >
        <Settings2 aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="max-h-[70vh] w-72 gap-3 overflow-x-hidden overflow-y-auto"
      >
        <p className="text-xs font-semibold">Pengaturan suara</p>

        <DeviceSection
          kind="audioinput"
          label="Mikrofon"
          onPicked={(deviceId) => update({ micDeviceId: deviceId })}
        />

        {supportsSinkId() ? (
          <DeviceSection
            kind="audiooutput"
            label="Output suara"
            onPicked={(deviceId) => update({ speakerDeviceId: deviceId })}
          />
        ) : (
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">
              Output suara
            </Label>
            <p className="text-xs text-muted-foreground">
              Pemilihan output tidak didukung browser ini.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">
            Pemrosesan mic
          </Label>
          <ProcessingToggle
            id="voice-noise-suppression"
            label="Peredam bising"
            checked={settings.noiseSuppression}
            onCheckedChange={(v) => void applyProcessing({ noiseSuppression: v })}
          />
          <ProcessingToggle
            id="voice-echo-cancellation"
            label="Pembatalan gema"
            checked={settings.echoCancellation}
            onCheckedChange={(v) => void applyProcessing({ echoCancellation: v })}
          />
          <ProcessingToggle
            id="voice-auto-gain"
            label="Penguatan otomatis"
            checked={settings.autoGainControl}
            onCheckedChange={(v) => void applyProcessing({ autoGainControl: v })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">
            Volume peserta
          </Label>
          <ParticipantVolumeList
            settings={settings}
            setParticipantVolume={setParticipantVolume}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
