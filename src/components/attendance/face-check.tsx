"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2,
  Send,
  Plus,
  Trash2,
  CircleCheckBig,
  Eye,
  TriangleAlert,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useWebcam } from "@/hooks/use-webcam";
import {
  useFaceDetection,
  type FaceDetection,
} from "@/hooks/use-face-detection";
import { useFaceMatcher } from "@/hooks/use-face-matcher";
import { MIN_CONFIDENCE, CONSENSUS_FRAMES } from "@/lib/attendance-constants";
import { playSuccessSound, playErrorSound } from "@/lib/attendance-sounds";

interface FaceCheckProps {
  type: "CHECK_IN" | "CHECK_OUT";
  userName: string;
  onDone: () => void;
  onCancel: () => void;
}

const MISMATCH_LIMIT = 18;
/** Jika kedip belum terdeteksi, tetap terima setelah jeda ini (ms). */
const BLINK_FALLBACK_MS = 4000;

export function FaceCheck({ type, userName, onDone, onCancel }: FaceCheckProps) {
  const isCheckIn = type === "CHECK_IN";

  const { videoRef, isActive, error: cameraError, startCamera, stopCamera } =
    useWebcam();
  const {
    error: matcherError,
    ready: matcherReady,
    loadFaceData,
    verifyFace,
  } = useFaceMatcher();

  const [phase, setPhase] = useState<"scanning" | "verified">("scanning");
  const [confidence, setConfidence] = useState(0);
  const [awaitingBlink, setAwaitingBlink] = useState(false);
  const [faceMismatch, setFaceMismatch] = useState(false);

  const [taskItems, setTaskItems] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const consensusRef = useRef({ count: 0, total: 0 });
  const mismatchRef = useRef(0);
  const pendingConfidenceRef = useRef(0);
  const verifiedRef = useRef(false);

  // Diproses tiap frame di dalam loop deteksi (bukan di useEffect) — verifikasi 1:1.
  const handleFrame = useCallback(
    (det: FaceDetection) => {
      if (verifiedRef.current) return;

      const result = verifyFace(det.descriptor);
      if (!result) return;

      // Wajah terdeteksi tapi bukan pemilik akun.
      if (!result.matched || result.confidence < MIN_CONFIDENCE) {
        consensusRef.current = { count: 0, total: 0 };
        mismatchRef.current += 1;
        if (mismatchRef.current >= MISMATCH_LIMIT) setFaceMismatch(true);
        return;
      }

      // Cocok — kumpulkan beberapa frame berturut-turut (consensus).
      mismatchRef.current = 0;
      setFaceMismatch(false);
      const c = consensusRef.current;
      c.count += 1;
      c.total += result.confidence;

      if (c.count >= CONSENSUS_FRAMES) {
        pendingConfidenceRef.current = c.total / c.count;
        consensusRef.current = { count: 0, total: 0 };
        setAwaitingBlink(true);
      }
    },
    [verifyFace],
  );

  const { modelsLoaded, modelsLoading, detection, blinkDetected, startDetection, stopDetection } =
    useFaceDetection(videoRef, isActive, handleFrame);

  const finalizeVerified = useCallback(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;
    stopDetection();
    stopCamera();
    setConfidence(pendingConfidenceRef.current);
    setPhase("verified");
    playSuccessSound();
  }, [stopDetection, stopCamera]);

  // Muat data wajah milik user + nyalakan kamera saat mount.
  useEffect(() => {
    void loadFaceData();
  }, [loadFaceData]);
  useEffect(() => {
    void startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // Mulai loop deteksi setelah model, kamera, dan data wajah siap.
  useEffect(() => {
    if (phase === "scanning" && modelsLoaded && isActive && matcherReady) {
      startDetection();
    }
  }, [phase, modelsLoaded, isActive, matcherReady, startDetection]);

  // Liveness: terima begitu user berkedip…
  useEffect(() => {
    if (awaitingBlink && blinkDetected) finalizeVerified();
  }, [awaitingBlink, blinkDetected, finalizeVerified]);

  // …atau terima lewat fallback waktu bila kedip tak terdeteksi.
  useEffect(() => {
    if (!awaitingBlink) return;
    const t = setTimeout(finalizeVerified, BLINK_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [awaitingBlink, finalizeVerified]);

  /* --------------------------- Task list helpers -------------------------- */
  const setItem = (i: number, v: string) =>
    setTaskItems((p) => p.map((it, idx) => (idx === i ? v : it)));
  const addItem = () => setTaskItems((p) => [...p, ""]);
  const removeItem = (i: number) =>
    setTaskItems((p) => p.filter((_, idx) => idx !== i));

  const submit = async () => {
    setSubmitting(true);
    setSubmitError("");
    const filled = taskItems.map((s) => s.trim()).filter(Boolean);
    const payload: Record<string, unknown> = { type, confidence };
    if (isCheckIn && filled.length) payload.todoList = filled;
    if (!isCheckIn && filled.length) payload.completedTasks = filled;

    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (res.ok) {
        onDone();
        return;
      }
      playErrorSound();
      setSubmitError(
        res.status === 429
          ? "Anda baru saja absen. Tunggu sebentar lalu coba lagi."
          : data.error || "Gagal menyimpan absensi.",
      );
    } catch {
      playErrorSound();
      setSubmitError("Gagal terhubung ke server.");
    }
    setSubmitting(false);
  };

  /* -------------------------------- Status -------------------------------- */
  let statusText = "Memuat modul pengenalan wajah…";
  if (cameraError) statusText = cameraError;
  else if (matcherError) statusText = matcherError;
  else if (modelsLoading || !modelsLoaded)
    statusText = "Memuat modul pengenalan wajah…";
  else if (!isActive) statusText = "Mengaktifkan kamera…";
  else if (!matcherReady) statusText = "Menyiapkan data wajah Anda…";
  else if (awaitingBlink) statusText = "Wajah cocok — kedipkan mata Anda";
  else if (faceMismatch)
    statusText = "Wajah tidak cocok dengan akun Anda. Pastikan ini benar Anda.";
  else statusText = "Posisikan wajah Anda di dalam lingkaran";

  const label = isCheckIn ? "Check In" : "Check Out";
  const blocked = !!cameraError || !!matcherError;

  /* ---------------------------- Verified screen --------------------------- */
  if (phase === "verified") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleCheckBig className="size-5 text-emerald-500" />
            Wajah terverifikasi — {label}
          </CardTitle>
          <CardDescription>
            Halo <strong>{userName}</strong>, wajah Anda cocok (
            {Math.round(confidence * 100)}%).{" "}
            {isCheckIn
              ? "Tuliskan rencana kerja hari ini (opsional), lalu konfirmasi."
              : "Tuliskan tugas yang sudah selesai (opsional), lalu konfirmasi."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">
              {isCheckIn ? "Rencana kerja hari ini" : "Tugas yang sudah selesai"}
            </span>
            {taskItems.map((item, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-muted-foreground flex h-8 w-5 items-center justify-center text-sm">
                  {i + 1}.
                </span>
                <Input
                  value={item}
                  onChange={(e) => setItem(i, e.target.value)}
                  placeholder={
                    isCheckIn
                      ? "Tulis rencana kerja…"
                      : "Tulis tugas yang selesai…"
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addItem();
                    }
                  }}
                />
                {taskItems.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(i)}
                    aria-label="Hapus item"
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={addItem}
            >
              <Plus />
              Tambah item
            </Button>
          </div>

          {submitError ? (
            <p className="text-destructive text-sm">{submitError}</p>
          ) : null}

          <div className="flex gap-2">
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : <Send />}
              Konfirmasi {label}
            </Button>
            <Button variant="ghost" onClick={onCancel} disabled={submitting}>
              Batal
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  /* ---------------------------- Scanning screen --------------------------- */
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scan Wajah — {label}</CardTitle>
        <CardDescription>
          Verifikasi 1:1: wajah Anda dicocokkan dengan data Anda sendiri.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="bg-muted relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="size-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />

          {/* Lingkaran panduan wajah */}
          {isActive && !blocked ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={cn(
                  "size-44 rounded-full border-4 transition-colors",
                  faceMismatch
                    ? "border-destructive/70"
                    : detection
                      ? "animate-pulse border-emerald-400"
                      : "border-white/50",
                )}
              />
            </div>
          ) : null}

          {/* Badge tunggu kedip */}
          {awaitingBlink ? (
            <div className="absolute inset-x-0 top-3 flex justify-center">
              <span className="bg-background/90 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium shadow-sm backdrop-blur">
                <Eye className="size-3.5" />
                Kedipkan mata
              </span>
            </div>
          ) : null}

          {/* Overlay loading / error */}
          {!isActive || blocked ? (
            <div className="bg-muted absolute inset-0 flex items-center justify-center p-6 text-center">
              <div className="flex flex-col items-center gap-2">
                {blocked ? (
                  <TriangleAlert className="text-destructive size-8" />
                ) : (
                  <Loader2 className="text-muted-foreground size-8 animate-spin" />
                )}
                <p className="text-muted-foreground text-sm">{statusText}</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Status pill */}
        {isActive && !blocked ? (
          <p
            className={cn(
              "rounded-lg px-4 py-2 text-center text-sm",
              faceMismatch
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground",
            )}
          >
            {statusText}
          </p>
        ) : null}

        <div className="flex justify-center">
          <Button variant="ghost" onClick={onCancel}>
            Batal
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
