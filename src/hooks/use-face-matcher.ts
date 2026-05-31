"use client";

import { useState, useCallback, useRef } from "react";
import { faceapi, createFaceMatcher, arrayToDescriptor } from "@/lib/face-api";
import { FACE_MATCH_THRESHOLD } from "@/lib/attendance-constants";

interface MyFaceData {
  userId: string;
  faceData: { descriptor: string }[];
}

interface VerifyResult {
  /** True jika wajah cocok dengan data wajah milik user yang login. */
  matched: boolean;
  /** Confidence kecocokan 0-1 (1 = identik). */
  confidence: number;
}

interface UseFaceMatcherReturn {
  isLoading: boolean;
  error: string | null;
  ready: boolean;
  loadFaceData: () => Promise<void>;
  verifyFace: (descriptor: Float32Array) => VerifyResult | null;
}

/**
 * Verifikasi wajah 1:1 — membandingkan wajah hasil scan HANYA dengan data
 * wajah milik user yang sedang login (anti titip absen). Data wajah orang
 * lain tidak pernah dimuat ke browser.
 */
export function useFaceMatcher(): UseFaceMatcherReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const matcherRef = useRef<ReturnType<typeof createFaceMatcher> | null>(null);
  const userIdRef = useRef<string>("");

  const loadFaceData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setReady(false);

    try {
      const res = await fetch("/api/face-data", { cache: "no-store" });
      if (!res.ok) throw new Error("Gagal memuat data wajah Anda");

      const data: MyFaceData = await res.json();

      if (!data.faceData || data.faceData.length === 0) {
        setError("Wajah Anda belum terdaftar");
        return;
      }

      const descriptors = data.faceData.map((fd) =>
        arrayToDescriptor(JSON.parse(fd.descriptor) as number[]),
      );

      userIdRef.current = data.userId;
      matcherRef.current = createFaceMatcher(
        [new faceapi.LabeledFaceDescriptors(data.userId, descriptors)],
        FACE_MATCH_THRESHOLD,
      );
      setReady(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat data wajah",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyFace = useCallback(
    (descriptor: Float32Array): VerifyResult | null => {
      if (!matcherRef.current) return null;

      const result = matcherRef.current.findBestMatch(descriptor);
      const matched =
        result.label !== "unknown" && result.label === userIdRef.current;

      return { matched, confidence: Math.max(0, 1 - result.distance) };
    },
    [],
  );

  return { isLoading, error, ready, loadFaceData, verifyFace };
}
