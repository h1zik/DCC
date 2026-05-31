"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { loadFaceApiModels, detectFaceFast, computeEAR } from "@/lib/face-api";
import type * as faceapi from "@vladmandic/face-api";

export type FaceDetection = faceapi.WithFaceDescriptor<
  faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>
>;

// Threshold dinaikkan: lebih mudah memicu kedip pada frame rate rendah
const EAR_BLINK_THRESHOLD = 0.26;

interface UseFaceDetectionReturn {
  modelsLoaded: boolean;
  modelsLoading: boolean;
  detection: FaceDetection | null;
  isDetecting: boolean;
  blinkDetected: boolean;
  resetBlink: () => void;
  startDetection: () => void;
  stopDetection: () => void;
}

/**
 * Loop deteksi wajah real-time dari elemen video, plus deteksi kedip
 * (EAR) sebagai liveness check sederhana anti-foto.
 *
 * `onResult` (opsional) dipanggil tiap frame berhasil — pemrosesan berat
 * (mis. pencocokan wajah) sebaiknya dilakukan di sini, bukan di useEffect,
 * agar tidak memicu cascading render.
 */
export function useFaceDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  isVideoActive: boolean,
  onResult?: (detection: FaceDetection) => void,
): UseFaceDetectionReturn {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [detection, setDetection] = useState<FaceDetection | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [blinkDetected, setBlinkDetected] = useState(false);
  const shouldDetectRef = useRef(false);
  const loopRunningRef = useRef(false);

  // Callback hasil tiap frame — disimpan di ref agar loop selalu pakai versi terbaru.
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  });

  // Pelacakan kedip
  const eyeWasOpenRef = useRef(false);
  const earHistoryRef = useRef<number[]>([]);

  // Load model saat mount
  useEffect(() => {
    let cancelled = false;

    loadFaceApiModels()
      .then(() => {
        if (!cancelled) {
          setModelsLoaded(true);
          setModelsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModelsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Loop deteksi dengan yield ke main thread agar UI tidak freeze
  const runLoop = useCallback(async () => {
    if (loopRunningRef.current) return;
    loopRunningRef.current = true;

    const yieldToMain = () =>
      new Promise<void>((r) => requestAnimationFrame(() => r()));

    do {
      while (shouldDetectRef.current) {
        await yieldToMain();
        if (!shouldDetectRef.current) break;

        if (
          videoRef.current &&
          videoRef.current.readyState >= 2 &&
          videoRef.current.videoWidth > 0
        ) {
          try {
            const result = await detectFaceFast(videoRef.current);

            if (!shouldDetectRef.current) break;

            if (result) {
              setDetection(result);
              onResultRef.current?.(result);

              // Pelacakan kedip via EAR
              const ear = computeEAR(result.landmarks);
              earHistoryRef.current.push(ear);
              if (earHistoryRef.current.length > 6) {
                earHistoryRef.current.shift();
              }

              if (ear >= EAR_BLINK_THRESHOLD) {
                eyeWasOpenRef.current = true;
              } else if (eyeWasOpenRef.current) {
                setBlinkDetected(true);
                eyeWasOpenRef.current = false;
              }

              // Pola dip: terbuka → tertutup → apa pun
              if (
                !eyeWasOpenRef.current &&
                earHistoryRef.current.length >= 3
              ) {
                const h = earHistoryRef.current;
                if (
                  h[h.length - 3] > EAR_BLINK_THRESHOLD &&
                  h[h.length - 2] < EAR_BLINK_THRESHOLD
                ) {
                  setBlinkDetected(true);
                }
              }
            } else {
              setDetection(null);
            }
          } catch {
            // abaikan error, lanjutkan loop
          }
        } else {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      await new Promise((r) => setTimeout(r, 50));
    } while (shouldDetectRef.current);

    loopRunningRef.current = false;
  }, [videoRef]);

  const startDetection = useCallback(() => {
    if (!modelsLoaded || !isVideoActive) return;
    shouldDetectRef.current = true;
    setIsDetecting(true);
    void runLoop();
  }, [modelsLoaded, isVideoActive, runLoop]);

  const stopDetection = useCallback(() => {
    shouldDetectRef.current = false;
    setIsDetecting(false);
    setDetection(null);
  }, []);

  const resetBlink = useCallback(() => {
    setBlinkDetected(false);
    eyeWasOpenRef.current = false;
    earHistoryRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      shouldDetectRef.current = false;
    };
  }, []);

  return {
    modelsLoaded,
    modelsLoading,
    detection,
    isDetecting,
    blinkDetected,
    resetBlink,
    startDetection,
    stopDetection,
  };
}
