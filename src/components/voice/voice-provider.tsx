"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
// HANYA import type — runtime LiveKit (~besar) dimuat lazy di join() dan di
// VoiceActiveSession, sehingga tidak membebani bundle semua halaman dashboard.
import type { Room } from "livekit-client";
import { toast } from "sonner";
import { micCaptureOptions, readVoiceSettings } from "./use-voice-settings";

const VoiceActiveSession = dynamic(() => import("./voice-active-session"), {
  ssr: false,
});

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

/** Halaman aplikasi ber-sesi — di luar ini (login, tautan publik) call diputus. */
function isAppPathname(pathname: string): boolean {
  return !pathname.startsWith("/login") && !pathname.startsWith("/shared/");
}

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice harus dipakai di dalam VoiceProvider.");
  return ctx;
}

/**
 * Provider voice global — dipasang di root (components/providers.tsx) sehingga
 * call tetap hidup ke mana pun user bernavigasi, termasuk menyeberang ke route
 * group (lab) alias Dominatus Lab. Saat panel call tidak terlihat, overlay
 * mengambang (draggable) menampilkan video + kontrol.
 */
export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
        // Muat runtime LiveKit saat benar-benar join (sekali; selanjutnya
        // dari cache modul browser).
        const livekitPromise = import("livekit-client");
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
        const { Room, RoomEvent, DisconnectReason, VideoPresets } =
          await livekitPromise;

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

  // Unmount provider (tutup tab / hard refresh) = putuskan call.
  useEffect(() => {
    return () => {
      joinSeqRef.current += 1;
      void roomRef.current?.disconnect().catch(() => undefined);
      roomRef.current = null;
    };
  }, []);

  /*
   * Keluar dari area aplikasi = putuskan call. Dulu ini gratis karena provider
   * ikut ter-unmount bersama layout (dashboard); sekarang providernya di root,
   * jadi batasnya ditegaskan di sini. Sasarannya sesi yang berakhir di tengah
   * call (middleware melempar ke /login) — tanpa ini, mic & share screen tetap
   * jalan di halaman login.
   */
  useEffect(() => {
    if (isAppPathname(pathname)) return;
    if (!roomRef.current && !activeCallRef.current) return;
    void leave();
  }, [pathname, leave]);

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
        <VoiceActiveSession
          room={room}
          deafened={deafened}
          showOverlay={!panelMounted}
        />
      ) : null}
    </VoiceContext.Provider>
  );
}
