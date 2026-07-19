"use client";

import "@livekit/components-styles";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DisconnectReason, Room, RoomEvent, VideoPresets } from "livekit-client";
import {
  RoomAudioRenderer,
  RoomContext,
  useRemoteParticipants,
} from "@livekit/components-react";
import { toast } from "sonner";
import { VoiceFloatingOverlay } from "./voice-floating-overlay";
import {
  micCaptureOptions,
  readVoiceSettings,
  useVoiceSettings,
} from "./use-voice-settings";

export type VoiceConnectionState = "disconnected" | "connecting" | "connected";

export type ActiveVoiceCall = {
  roomId: string;
  channelId: string;
  channelName: string;
};

type VoiceContextValue = {
  /** Instance Room LiveKit saat tersambung; null saat idle/connecting. */
  room: Room | null;
  connectionState: VoiceConnectionState;
  activeCall: ActiveVoiceCall | null;
  /** Tuli: senyapkan semua audio masuk (mic tetap sesuai toggle). */
  deafened: boolean;
  setDeafened: (value: boolean) => void;
  join: (call: ActiveVoiceCall) => Promise<void>;
  leave: () => Promise<void>;
  /** Bertambah tiap join/leave — dipakai poller participants untuk refresh cepat. */
  pollNonce: number;
  /**
   * Panel call besar (halaman chat) sedang menampilkan call aktif —
   * overlay mengambang disembunyikan supaya tidak dobel.
   */
  panelMounted: boolean;
  setPanelMounted: (mounted: boolean) => void;
};

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice harus dipakai di dalam VoiceProvider.");
  return ctx;
}

/**
 * Provider voice global — dipasang di layout (dashboard) sehingga call tetap
 * hidup ke mana pun user bernavigasi. Saat panel call tidak terlihat, overlay
 * mengambang (draggable) menampilkan video + kontrol.
 */
export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [connectionState, setConnectionState] =
    useState<VoiceConnectionState>("disconnected");
  const [activeCall, setActiveCall] = useState<ActiveVoiceCall | null>(null);
  const [deafened, setDeafened] = useState(false);
  const [pollNonce, setPollNonce] = useState(0);
  const [panelMounted, setPanelMounted] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const activeCallRef = useRef<ActiveVoiceCall | null>(null);
  // Nomor urut join untuk membatalkan join lama yang masih in-flight.
  const joinSeqRef = useRef(0);

  const bumpPollNonce = useCallback(() => {
    setPollNonce((n) => n + 1);
  }, []);

  const leave = useCallback(async () => {
    joinSeqRef.current += 1;
    const current = roomRef.current;
    roomRef.current = null;
    activeCallRef.current = null;
    setRoom(null);
    setActiveCall(null);
    setConnectionState("disconnected");
    setDeafened(false);
    if (current) await current.disconnect().catch(() => undefined);
    bumpPollNonce();
  }, [bumpPollNonce]);

  const join = useCallback(
    async (call: ActiveVoiceCall) => {
      if (roomRef.current && activeCallRef.current?.channelId === call.channelId) {
        return; // sudah tersambung ke channel ini
      }
      const seq = ++joinSeqRef.current;

      // Pindah channel: putuskan call lama dulu.
      const prev = roomRef.current;
      roomRef.current = null;
      setRoom(null);
      if (prev) void prev.disconnect().catch(() => undefined);

      activeCallRef.current = call;
      setActiveCall(call);
      setConnectionState("connecting");
      setDeafened(false);
      try {
        const res = await fetch(
          `/api/voice/token?channelId=${encodeURIComponent(call.channelId)}`,
          { cache: "no-store" },
        );
        if (res.status === 503) {
          throw new Error(
            "Voice belum dikonfigurasi di server (env LiveKit kosong).",
          );
        }
        if (!res.ok) throw new Error("Gagal mendapatkan akses voice.");
        const { token, serverUrl } = (await res.json()) as {
          token: string;
          serverUrl: string;
        };

        // Preferensi audio tersimpan (device + pemrosesan mic). DeviceId basi
        // aman: constraint non-exact, browser fallback ke default.
        const settings = readVoiceSettings();
        const canSetSink =
          typeof HTMLAudioElement !== "undefined" &&
          "setSinkId" in HTMLAudioElement.prototype;
        const nextRoom = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
          audioCaptureDefaults: micCaptureOptions(settings),
          ...(canSetSink && settings.speakerDeviceId
            ? { audioOutput: { deviceId: settings.speakerDeviceId } }
            : {}),
        });
        nextRoom.on(RoomEvent.Disconnected, (reason) => {
          if (roomRef.current !== nextRoom) return;
          roomRef.current = null;
          activeCallRef.current = null;
          setRoom(null);
          setActiveCall(null);
          setConnectionState("disconnected");
          setDeafened(false);
          if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
            toast.info("Voice terputus — kamu tersambung dari tab lain.");
          }
          bumpPollNonce();
        });

        await nextRoom.connect(serverUrl, token);
        if (joinSeqRef.current !== seq) {
          // User sudah pindah/keluar selama connect berlangsung.
          void nextRoom.disconnect().catch(() => undefined);
          return;
        }
        roomRef.current = nextRoom;
        setRoom(nextRoom);
        setConnectionState("connected");
        try {
          await nextRoom.localParticipant.setMicrophoneEnabled(true);
        } catch {
          toast.error(
            "Mikrofon tidak dapat diakses — periksa izin browser, lalu nyalakan mic dari tombol kontrol.",
          );
        }
        bumpPollNonce();
      } catch (e) {
        if (joinSeqRef.current === seq) {
          activeCallRef.current = null;
          setActiveCall(null);
          setConnectionState("disconnected");
        }
        toast.error(
          e instanceof Error ? e.message : "Gagal bergabung ke voice channel.",
        );
      }
    },
    [bumpPollNonce],
  );

  // Unmount provider (keluar dari area dashboard / hard refresh) = putuskan call.
  useEffect(() => {
    return () => {
      joinSeqRef.current += 1;
      void roomRef.current?.disconnect().catch(() => undefined);
      roomRef.current = null;
    };
  }, []);

  const value = useMemo<VoiceContextValue>(
    () => ({
      room,
      connectionState,
      activeCall,
      deafened,
      setDeafened,
      join,
      leave,
      pollNonce,
      panelMounted,
      setPanelMounted,
    }),
    [
      room,
      connectionState,
      activeCall,
      deafened,
      join,
      leave,
      pollNonce,
      panelMounted,
    ],
  );

  return (
    <VoiceContext.Provider value={value}>
      {children}
      {room ? (
        <RoomContext.Provider value={room}>
          <RoomAudioRenderer muted={deafened} />
          <VoiceVolumeApplier />
          {!panelMounted ? <VoiceFloatingOverlay /> : null}
        </RoomContext.Provider>
      ) : null}
    </VoiceContext.Provider>
  );
}

/**
 * Menerapkan volume per-partisipan dari settings ke LiveKit. `setVolume`
 * tersimpan di volumeMap internal — aman dipanggil sebelum track audio tiba,
 * dan diterapkan ulang tiap (re)subscribe. Satu-satunya jalur tulis volume.
 */
function VoiceVolumeApplier() {
  const { settings } = useVoiceSettings();
  const participants = useRemoteParticipants();
  useEffect(() => {
    for (const p of participants) {
      p.setVolume(settings.volumes[p.identity] ?? 1);
    }
  }, [participants, settings.volumes]);
  return null;
}
