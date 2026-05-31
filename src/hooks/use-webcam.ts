"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface UseWebcamReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  error: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
}

function describeCameraError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") {
      return "Izin kamera ditolak. Klik ikon kamera di address bar, pilih Izinkan, lalu coba lagi.";
    }
    if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      return "Kamera tidak ditemukan di perangkat ini.";
    }
    if (err.name === "NotReadableError" || err.name === "TrackStartError") {
      return "Kamera sedang dipakai aplikasi/tab lain (Teams, Zoom, WhatsApp, dll). Tutup dulu, lalu coba lagi.";
    }
    if (err.name === "OverconstrainedError") {
      return "Kamera tidak mendukung pengaturan yang diminta.";
    }
    if (err.name === "SecurityError") {
      return "Akses kamera diblokir. Buka aplikasi lewat localhost atau HTTPS.";
    }
  }
  return "Gagal mengakses kamera.";
}

/**
 * Mengelola stream kamera depan untuk verifikasi & registrasi wajah.
 *
 * Tahan terhadap pemanggilan ganda: di React Strict Mode (dev) effect
 * dijalankan 2×, jadi `startCamera` bisa terpanggil dua kali. `startingRef`
 * memastikan hanya satu permintaan `getUserMedia` yang berjalan, dan
 * `wantCameraRef` membuang stream bila komponen sudah dilepas saat menunggu.
 */
export function useWebcam(): UseWebcamReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startingRef = useRef(false);
  const wantCameraRef = useRef(false);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    wantCameraRef.current = true;
    // Sudah ada stream, atau permintaan sedang berjalan — jangan minta lagi.
    if (streamRef.current || startingRef.current) return;

    startingRef.current = true;
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
          frameRate: { ideal: 20 },
        },
      });

      // Komponen sudah dilepas / kamera dimatikan saat menunggu — buang stream.
      if (!wantCameraRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {
          // play() bisa di-interrupt — abaikan, stream tetap aktif.
        }
      }
      setIsActive(true);
    } catch (err) {
      if (wantCameraRef.current) {
        setError(describeCameraError(err));
        setIsActive(false);
      }
    } finally {
      startingRef.current = false;
    }
  }, []);

  const stopCamera = useCallback(() => {
    wantCameraRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  // Pastikan kamera mati saat komponen benar-benar dilepas.
  useEffect(() => {
    return () => {
      wantCameraRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return { videoRef, isActive, error, startCamera, stopCamera };
}
