"use client";

import { useEffect, useRef, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import {
  ArrowLeft,
  Ear,
  Loader2,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SOUNDBOARD_COOLDOWN_MS } from "@/lib/voice-events";
import {
  BUILTIN_SOUNDS,
  BUILTIN_SOUND_PREFIX,
  ROOM_SOUND_DEFAULT_EMOJI,
  ROOM_SOUND_MAX_BYTES,
  ROOM_SOUND_MAX_BYTES_LABEL,
  ROOM_SOUND_MAX_DURATION_MS,
  ROOM_SOUND_MAX_PER_ROOM,
  ROOM_SOUND_NAME_MAX,
  roomSoundExtension,
  type RoomSoundView,
} from "@/lib/voice-sounds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  measureAudioDurationMs,
  playSoundboardSound,
} from "./sound-engine";
import { refreshRoomSounds, useRoomSounds } from "./use-room-sounds";
import { useVoiceSettings } from "./use-voice-settings";
import { controlButtonClassName } from "./voice-controls";
import { localSoundCooldownLeft, sendVoiceEvent } from "./voice-events-store";
import { useVoice } from "./voice-provider";

type PadSound = {
  id: string;
  name: string;
  emoji: string;
  durationMs: number;
  custom?: RoomSoundView;
};

/** Ikon soundboard: grid pad 2×2 — sama dengan bentuk panelnya. */
function PadsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" opacity=".55" />
      <rect x="3" y="13" width="8" height="8" rx="2" opacity=".55" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}

function SoundPad({
  sound,
  active,
  disabled,
  onPress,
  onDelete,
}: {
  sound: PadSound;
  /** Pad ini yang terakhir ditekan & masih berbunyi. */
  active: boolean;
  disabled: boolean;
  onPress: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="group/pad relative">
      <button
        type="button"
        disabled={disabled}
        onClick={onPress}
        title={sound.name}
        className={cn(
          "voice-pad border-border bg-muted/50 hover:bg-muted focus-visible:ring-ring relative flex aspect-square w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border px-1 transition-[transform,background-color,box-shadow] duration-100 focus-visible:ring-2 focus-visible:outline-none",
          "shadow-[inset_0_-3px_0_0_color-mix(in_oklab,var(--foreground)_10%,transparent)] active:translate-y-0.5 active:shadow-none",
          active && "border-primary/60 bg-primary/10",
          disabled && !active && "opacity-50",
        )}
      >
        <span className="text-2xl leading-none" aria-hidden>
          {sound.emoji}
        </span>
        <span className="line-clamp-2 w-full text-center text-[11px] leading-tight font-medium break-words">
          {sound.name}
        </span>
        {active ? (
          <span
            aria-hidden
            className="voice-pad-progress bg-primary absolute bottom-0 left-0 h-1 w-full origin-left"
            style={{ animationDuration: `${sound.durationMs}ms` }}
          />
        ) : null}
      </button>
      {onDelete ? (
        <button
          type="button"
          aria-label={`Hapus suara ${sound.name}`}
          title="Hapus suara"
          onClick={onDelete}
          className="bg-background text-muted-foreground hover:text-destructive focus-visible:ring-ring border-border absolute -top-1.5 -right-1.5 inline-flex size-6 items-center justify-center rounded-full border opacity-0 shadow-sm transition-opacity group-hover/pad:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
        >
          <Trash2 className="size-3" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function UploadSoundForm({
  roomId,
  onDone,
  onCancel,
}: {
  roomId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function pickFile(next: File | null) {
    setFile(null);
    setError(null);
    if (!next) return;
    if (!roomSoundExtension(next.type, next.name)) {
      setError("Format harus MP3 atau WAV.");
      return;
    }
    if (next.size > ROOM_SOUND_MAX_BYTES) {
      setError(`Ukuran berkas maksimal ${ROOM_SOUND_MAX_BYTES_LABEL}.`);
      return;
    }
    try {
      const ms = await measureAudioDurationMs(next);
      if (ms > ROOM_SOUND_MAX_DURATION_MS) {
        setError(
          `Durasi ${(ms / 1000).toFixed(1)} detik — maksimal ${ROOM_SOUND_MAX_DURATION_MS / 1000} detik. Potong dulu audionya.`,
        );
        return;
      }
      setDurationMs(Math.max(1, ms));
      setFile(next);
      if (!name) {
        setName(
          next.name.replace(/\.[^.]+$/, "").slice(0, ROOM_SOUND_NAME_MAX),
        );
      }
    } catch {
      setError("Berkas audio tidak bisa dibaca. Coba berkas lain.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("name", name);
      body.set("emoji", emoji);
      body.set("durationMs", String(durationMs));
      const res = await fetch(
        `/api/voice/${encodeURIComponent(roomId)}/sounds`,
        { method: "POST", body },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Gagal menambah suara.");
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah suara.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Kembali ke soundboard"
          className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring inline-flex size-7 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        <p className="text-sm font-semibold">Tambah suara</p>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="voice-sound-file" className="text-xs">
          Berkas audio
        </Label>
        <Input
          id="voice-sound-file"
          type="file"
          accept=".mp3,.wav,audio/mpeg,audio/wav"
          className="text-xs"
          onChange={(e) => void pickFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-muted-foreground text-[11px]">
          MP3 atau WAV, maksimal {ROOM_SOUND_MAX_DURATION_MS / 1000} detik dan{" "}
          {ROOM_SOUND_MAX_BYTES_LABEL}.
        </p>
      </div>

      <div className="grid grid-cols-[4.5rem_1fr] gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="voice-sound-emoji" className="text-xs">
            Emoji
          </Label>
          <Input
            id="voice-sound-emoji"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder={ROOM_SOUND_DEFAULT_EMOJI}
            maxLength={16}
            className="text-center text-base"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="voice-sound-name" className="text-xs">
            Nama
          </Label>
          <Input
            id="voice-sound-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={ROOM_SOUND_NAME_MAX}
            placeholder="mis. Tawa jahat"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="sm" disabled={!file || !name.trim() || saving}>
        {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Tambah suara
      </Button>
    </form>
  );
}

/**
 * Tombol + popover soundboard. Menekan pad mengirim id suara ke semua peserta;
 * tiap klien (termasuk kita) memutarnya lokal. Mode pratinjau = dengar sendiri.
 */
export function VoiceSoundboard({ compact }: { compact?: boolean }) {
  const room = useRoomContext();
  const { activeCall, deafened } = useVoice();
  const roomId = activeCall?.roomId ?? null;
  const customSounds = useRoomSounds(roomId);
  const { settings, update } = useVoiceSettings();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"pads" | "upload">("pads");
  const [preview, setPreview] = useState(false);
  const [activePad, setActivePad] = useState<string | null>(null);
  const [coolingDown, setCoolingDown] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  const pads: PadSound[] = BUILTIN_SOUNDS.map((s) => ({
    id: `${BUILTIN_SOUND_PREFIX}${s.id}`,
    name: s.name,
    emoji: s.emoji,
    durationMs: s.durationMs,
  }));
  const customPads: PadSound[] = customSounds.map((s) => ({
    id: s.id,
    name: s.name,
    emoji: s.emoji ?? ROOM_SOUND_DEFAULT_EMOJI,
    durationMs: s.durationMs,
    custom: s,
  }));

  function after(ms: number, fn: () => void) {
    timers.current.push(window.setTimeout(fn, ms));
  }

  function press(pad: PadSound) {
    if (preview) {
      playSoundboardSound(pad.id, customSounds);
    } else {
      if (localSoundCooldownLeft(room.localParticipant.identity) > 0) return;
      void sendVoiceEvent(room, { t: "sound", id: pad.id });
      setCoolingDown(true);
      after(SOUNDBOARD_COOLDOWN_MS, () => setCoolingDown(false));
    }
    setActivePad(pad.id);
    after(pad.durationMs, () =>
      setActivePad((current) => (current === pad.id ? null : current)),
    );
  }

  async function remove(sound: RoomSoundView) {
    if (!roomId) return;
    if (!window.confirm(`Hapus suara "${sound.name}" dari soundboard ruangan?`)) {
      return;
    }
    const res = await fetch(
      `/api/voice/${encodeURIComponent(roomId)}/sounds/${encodeURIComponent(sound.id)}`,
      { method: "DELETE" },
    ).catch(() => null);
    if (!res?.ok) {
      toast.error("Gagal menghapus suara.");
      return;
    }
    toast.success("Suara dihapus.");
    await refreshRoomSounds(roomId);
    void sendVoiceEvent(room, { t: "sounds-changed" }, { echo: false });
  }

  const silenced = deafened || settings.soundboardMuted;
  const volumePercent = Math.round(settings.soundboardVolume * 100);
  const full = customSounds.length >= ROOM_SOUND_MAX_PER_ROOM;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setView("pads");
      }}
    >
      <PopoverTrigger
        aria-label="Soundboard"
        title="Soundboard"
        className={controlButtonClassName({ active: open, compact })}
      >
        <PadsIcon />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="max-h-[70vh] w-[21rem] max-w-[calc(100vw-1.5rem)] gap-3 overflow-x-hidden overflow-y-auto p-3"
      >
        {view === "upload" && roomId ? (
          <UploadSoundForm
            roomId={roomId}
            onCancel={() => setView("pads")}
            onDone={() => {
              setView("pads");
              toast.success("Suara ditambahkan ke soundboard.");
              void refreshRoomSounds(roomId);
              void sendVoiceEvent(room, { t: "sounds-changed" }, { echo: false });
            }}
          />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Soundboard</p>
              <button
                type="button"
                aria-pressed={preview}
                onClick={() => setPreview((p) => !p)}
                title="Pratinjau: suara hanya terdengar olehmu"
                className={cn(
                  "focus-visible:ring-ring ml-auto inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  preview
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                <Ear className="size-3.5" aria-hidden />
                Pratinjau
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={settings.soundboardMuted}
                aria-label={
                  settings.soundboardMuted
                    ? "Bunyikan soundboard"
                    : "Bisukan soundboard"
                }
                title={
                  settings.soundboardMuted
                    ? "Bunyikan soundboard"
                    : "Bisukan soundboard di perangkatmu"
                }
                onClick={() =>
                  update({ soundboardMuted: !settings.soundboardMuted })
                }
                className={cn(
                  "focus-visible:ring-ring inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  settings.soundboardMuted
                    ? "bg-destructive/15 text-destructive"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {settings.soundboardMuted ? (
                  <VolumeX className="size-4" aria-hidden />
                ) : (
                  <Volume2 className="size-4" aria-hidden />
                )}
              </button>
              <Slider
                value={volumePercent}
                min={0}
                max={100}
                step={1}
                disabled={settings.soundboardMuted}
                aria-label="Volume soundboard"
                onValueChange={(value) =>
                  update({ soundboardVolume: value / 100 })
                }
              />
              <span className="text-muted-foreground w-9 shrink-0 text-right text-xs tabular-nums">
                {volumePercent}%
              </span>
            </div>

            {silenced && !preview ? (
              <p className="bg-muted text-muted-foreground rounded-md px-2 py-1.5 text-xs">
                {deafened
                  ? "Kamu sedang tuli — suara tetap terkirim ke yang lain, tapi tidak terdengar olehmu."
                  : "Soundboard dibisukan di perangkatmu — suara tetap terkirim ke yang lain."}
              </p>
            ) : null}

            <div className="grid grid-cols-4 gap-2">
              {pads.map((pad) => (
                <SoundPad
                  key={pad.id}
                  sound={pad}
                  active={activePad === pad.id}
                  disabled={coolingDown && !preview}
                  onPress={() => press(pad)}
                />
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-semibold">Suara ruangan ini</p>
                <p className="text-muted-foreground text-[11px] tabular-nums">
                  {customSounds.length}/{ROOM_SOUND_MAX_PER_ROOM}
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {customPads.map((pad) => (
                  <SoundPad
                    key={pad.id}
                    sound={pad}
                    active={activePad === pad.id}
                    disabled={coolingDown && !preview}
                    onPress={() => press(pad)}
                    onDelete={
                      pad.custom?.canDelete
                        ? () => void remove(pad.custom!)
                        : undefined
                    }
                  />
                ))}
                {full ? null : (
                  <button
                    type="button"
                    onClick={() => setView("upload")}
                    className="border-border text-muted-foreground hover:border-primary/60 hover:text-foreground focus-visible:ring-ring flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <Plus className="size-5" aria-hidden />
                    Tambah
                  </button>
                )}
              </div>
              {customSounds.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  Belum ada suara khas ruangan ini. Unggah klip pendek — semua
                  anggota bisa memakainya.
                </p>
              ) : null}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
