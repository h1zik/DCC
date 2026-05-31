"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Camera,
  Upload,
  ImagePlus,
  Check,
  Loader2,
  Trash2,
  RotateCcw,
  CircleCheckBig,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWebcam } from "@/hooks/use-webcam";
import {
  loadFaceApiModels,
  detectFace,
  quickDetectFace,
  detectFaceFromImageUrl,
  descriptorToArray,
  validateFacePose,
} from "@/lib/face-api";
import { FACE_CAPTURE_STEPS } from "@/lib/attendance-constants";

interface CapturedDescriptor {
  descriptor: number[];
  label: string;
}

interface UploadedPhoto {
  file: File;
  preview: string;
  status: "pending" | "processing" | "success" | "error";
  error?: string;
}

interface FaceEnrollProps {
  /** True jika user sudah pernah mendaftar (registrasi ulang). */
  reenroll: boolean;
  onDone: () => void;
  onCancel: () => void;
}

const PHOTO_LABELS = ["foto-1", "foto-2", "foto-3", "foto-4", "foto-5"];

type Step = "method" | "camera" | "upload" | "processing" | "done";
type GuidedStatus = "detecting" | "stabilizing" | "captured" | "timeout";

export function FaceEnroll({ reenroll, onDone, onCancel }: FaceEnrollProps) {
  const { videoRef, isActive, error: cameraError, startCamera, stopCamera } =
    useWebcam();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("method");
  const [captures, setCaptures] = useState<CapturedDescriptor[]>([]);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [modelsReady, setModelsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // State panduan kamera
  const [guidedStep, setGuidedStep] = useState(0);
  const [guidedStatus, setGuidedStatus] = useState<GuidedStatus>("detecting");
  const [retryCount, setRetryCount] = useState(0);
  const [poseHint, setPoseHint] = useState("");
  const detectLoopRef = useRef(false);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Muat model face-api
  useEffect(() => {
    void loadFaceApiModels().then(() => setModelsReady(true));
  }, []);

  // Ref status dipakai loop async (yang tidak ber-deps pada guidedStatus)
  // agar selalu membaca nilai terbaru. Disinkronkan lewat effect.
  const guidedStatusRef = useRef<GuidedStatus>("detecting");
  useEffect(() => {
    guidedStatusRef.current = guidedStatus;
  }, [guidedStatus]);

  const clearGuidedTimers = useCallback(() => {
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  }, []);

  /* ----------------------------- Mode kamera ----------------------------- */
  const startCameraCapture = () => {
    setStep("camera");
    setCaptures([]);
    setGuidedStep(0);
    setGuidedStatus("detecting");
    setError("");
    void startCamera();
  };

  // Loop deteksi terpandu — restart hanya saat step/guidedStep berubah.
  useEffect(() => {
    if (step !== "camera" || !isActive || !modelsReady) return;
    if (guidedStatusRef.current !== "detecting") return;

    detectLoopRef.current = true;
    clearGuidedTimers();

    // Timeout 15 detik per langkah
    timeoutTimerRef.current = setTimeout(() => {
      detectLoopRef.current = false;
      clearGuidedTimers();
      setGuidedStatus("timeout");
    }, 15000);

    setPoseHint("");

    const loop = async () => {
      while (detectLoopRef.current) {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          await new Promise((r) => setTimeout(r, 100));
          continue;
        }

        try {
          const hasFace = await quickDetectFace(videoRef.current);
          if (!detectLoopRef.current) break;

          if (hasFace) {
            const det = await detectFace(videoRef.current);
            if (!detectLoopRef.current) break;

            if (det) {
              // Loop di-restart tiap guidedStep berubah (ada di deps effect),
              // jadi closure `guidedStep` selalu benar untuk run ini.
              const currentStep = guidedStep;
              const expectedPose =
                FACE_CAPTURE_STEPS[currentStep]?.label || "front";

              const { valid, hint } = validateFacePose(
                det.landmarks,
                expectedPose,
              );
              if (!valid) {
                setPoseHint(hint);
                setGuidedStatus("detecting");
                await new Promise((r) => setTimeout(r, 300));
                continue;
              }

              // Pose cocok — tahan 1 detik lalu validasi ulang
              setPoseHint("");
              setGuidedStatus("stabilizing");
              await new Promise((r) => setTimeout(r, 1000));
              if (!detectLoopRef.current) break;

              const reDet = await detectFace(videoRef.current);
              if (!detectLoopRef.current) break;
              if (!reDet) {
                setGuidedStatus("detecting");
                continue;
              }
              const reValid = validateFacePose(reDet.landmarks, expectedPose);
              if (!reValid.valid) {
                setPoseHint(reValid.hint);
                setGuidedStatus("detecting");
                continue;
              }

              // Pose tetap valid — rekam!
              const descriptor = descriptorToArray(reDet.descriptor);
              const label =
                FACE_CAPTURE_STEPS[currentStep]?.label || `step-${currentStep}`;

              detectLoopRef.current = false;
              clearGuidedTimers();
              setPoseHint("");
              setGuidedStatus("captured");
              setCaptures((prev) => [...prev, { descriptor, label }]);

              setTimeout(() => {
                const nextStep = currentStep + 1;
                if (nextStep >= FACE_CAPTURE_STEPS.length) {
                  stopCamera();
                  setStep("done");
                } else {
                  setGuidedStep(nextStep);
                  setGuidedStatus("detecting");
                }
              }, 1500);
              return;
            }
          } else {
            setPoseHint("");
          }
        } catch {
          // abaikan, lanjutkan loop
        }

        await new Promise((r) => setTimeout(r, 150));
      }
    };
    void loop();

    return () => {
      detectLoopRef.current = false;
      clearGuidedTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isActive, modelsReady, guidedStep, retryCount]);

  const retryGuidedStep = () => {
    setGuidedStatus("detecting");
    setRetryCount((c) => c + 1);
    setError("");
  };

  const exitCamera = () => {
    detectLoopRef.current = false;
    clearGuidedTimers();
    stopCamera();
    setCaptures([]);
    setStep("method");
  };

  /* ----------------------------- Mode upload ----------------------------- */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const next: UploadedPhoto[] = files.slice(0, 5).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      status: "pending" as const,
    }));
    setPhotos((prev) => [...prev, ...next].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const processPhotos = async () => {
    if (photos.length === 0) {
      setError("Pilih minimal 1 foto.");
      return;
    }
    setStep("processing");
    setError("");
    const newCaptures: CapturedDescriptor[] = [];

    for (let i = 0; i < photos.length; i++) {
      setPhotos((prev) =>
        prev.map((p, idx) =>
          idx === i ? { ...p, status: "processing" as const } : p,
        ),
      );
      try {
        const det = await detectFaceFromImageUrl(photos[i].preview);
        if (!det) {
          setPhotos((prev) =>
            prev.map((p, idx) =>
              idx === i
                ? { ...p, status: "error" as const, error: "Wajah tak terdeteksi" }
                : p,
            ),
          );
          continue;
        }
        newCaptures.push({
          descriptor: descriptorToArray(det.descriptor),
          label: PHOTO_LABELS[i] || `foto-${i + 1}`,
        });
        setPhotos((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, status: "success" as const } : p,
          ),
        );
      } catch {
        setPhotos((prev) =>
          prev.map((p, idx) =>
            idx === i
              ? { ...p, status: "error" as const, error: "Gagal memproses" }
              : p,
          ),
        );
      }
    }

    if (newCaptures.length === 0) {
      setError(
        "Tidak ada wajah yang terdeteksi. Pakai foto wajah yang jelas & menghadap depan.",
      );
      setStep("upload");
      return;
    }
    setCaptures(newCaptures);
    setStep("done");
  };

  /* -------------------------------- Save --------------------------------- */
  const saveDescriptors = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/face-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descriptors: captures }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Gagal menyimpan data wajah.");
      }
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      onDone();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menyimpan data wajah.",
      );
      setSaving(false);
    }
  };

  const resetAll = () => {
    setCaptures([]);
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotos([]);
    setError("");
    setStep("method");
  };

  /* -------------------------------------------------------------------------- */
  /*                                  Render                                   */
  /* -------------------------------------------------------------------------- */

  // STEP: Pilih metode
  if (step === "method") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {reenroll ? "Perbarui Data Wajah" : "Daftarkan Wajah Anda"}
          </CardTitle>
          <CardDescription>
            Pilih cara mendaftarkan wajah. Data lama (jika ada) akan diganti.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={startCameraCapture}
              disabled={!modelsReady}
              className="hover:border-primary hover:bg-primary/5 flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Camera className="text-primary size-9" />
              <div>
                <p className="font-semibold">Scan Kamera</p>
                <p className="text-muted-foreground text-sm">
                  Terpandu 4 pose — paling akurat
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStep("upload")}
              disabled={!modelsReady}
              className="hover:border-primary hover:bg-primary/5 flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="text-primary size-9" />
              <div>
                <p className="font-semibold">Upload Foto</p>
                <p className="text-muted-foreground text-sm">
                  Unggah 1-5 foto wajah dari galeri
                </p>
              </div>
            </button>
          </div>
          {!modelsReady ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Memuat modul pengenalan wajah…
            </p>
          ) : null}
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button variant="ghost" className="self-start" onClick={onCancel}>
            Batal
          </Button>
        </CardContent>
      </Card>
    );
  }

  // STEP: Upload / processing
  if (step === "upload" || step === "processing") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upload Foto Wajah</CardTitle>
          <CardDescription>
            Unggah 1-5 foto wajah yang jelas. Lebih banyak foto = lebih akurat.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {photos.map((photo, idx) => (
                <div key={idx} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.preview}
                    alt={`Foto ${idx + 1}`}
                    className={cn(
                      "aspect-square w-full rounded-lg border-2 object-cover",
                      photo.status === "success"
                        ? "border-emerald-500"
                        : photo.status === "error"
                          ? "border-destructive"
                          : photo.status === "processing"
                            ? "animate-pulse border-blue-500"
                            : "border-border",
                    )}
                  />
                  {photo.status === "success" ? (
                    <span className="absolute top-1 right-1 rounded-full bg-emerald-500 p-1 text-white">
                      <Check className="size-3" />
                    </span>
                  ) : null}
                  {photo.status === "processing" ? (
                    <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30">
                      <Loader2 className="size-6 animate-spin text-white" />
                    </span>
                  ) : null}
                  {photo.status === "error" ? (
                    <span className="bg-destructive absolute inset-x-0 bottom-0 rounded-b-lg p-1 text-center text-[10px] text-white">
                      {photo.error}
                    </span>
                  ) : null}
                  {step === "upload" ? (
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="bg-destructive absolute top-1 left-1 rounded-full p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Hapus foto"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {step === "upload" && photos.length < 5 ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="hover:border-primary hover:bg-primary/5 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-8 transition-colors"
              >
                <ImagePlus className="text-muted-foreground size-7" />
                <p className="text-muted-foreground text-sm">
                  Klik untuk pilih foto ({photos.length}/5)
                </p>
              </button>
            </>
          ) : null}

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          {step === "processing" ? (
            <p className="text-muted-foreground flex items-center justify-center gap-2 py-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Memproses foto… mohon tunggu
            </p>
          ) : (
            <div className="flex gap-2">
              <Button onClick={processPhotos} disabled={photos.length === 0}>
                Proses {photos.length} Foto
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  photos.forEach((p) => URL.revokeObjectURL(p.preview));
                  setPhotos([]);
                  setError("");
                  setStep("method");
                }}
              >
                Kembali
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // STEP: Camera (guided)
  if (step === "camera") {
    const captured = guidedStatus === "captured";
    const timeout = guidedStatus === "timeout";
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scan Wajah</CardTitle>
          <CardDescription>
            Ikuti instruksi di layar — wajah direkam otomatis ketika pose sesuai.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Indikator langkah */}
          <div className="flex items-center justify-center gap-2">
            {FACE_CAPTURE_STEPS.map((s, idx) => (
              <div key={s.label} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full text-sm font-semibold transition-all",
                    idx < guidedStep
                      ? "bg-emerald-500 text-white"
                      : idx === guidedStep
                        ? "bg-primary text-primary-foreground ring-primary/30 ring-2 ring-offset-2"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {idx < guidedStep ? <Check className="size-4" /> : idx + 1}
                </div>
                {idx < FACE_CAPTURE_STEPS.length - 1 ? (
                  <div
                    className={cn(
                      "h-0.5 w-6",
                      idx < guidedStep ? "bg-emerald-500" : "bg-muted",
                    )}
                  />
                ) : null}
              </div>
            ))}
          </div>

          {/* Kamera */}
          <div className="relative mx-auto aspect-video w-full max-w-md overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="size-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />

            {!isActive ? (
              <div className="absolute inset-0 flex items-center justify-center bg-muted text-sm text-muted-foreground">
                {cameraError || "Mengaktifkan kamera…"}
              </div>
            ) : null}

            {isActive && !captured && !timeout ? (
              <>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div
                    className={cn(
                      "size-44 rounded-full border-4 transition-colors",
                      guidedStatus === "stabilizing"
                        ? "animate-pulse border-emerald-400"
                        : "border-white/50",
                    )}
                  />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-center">
                  <p className="text-base font-medium text-white">
                    {FACE_CAPTURE_STEPS[guidedStep]?.instruction}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-sm",
                      guidedStatus === "stabilizing"
                        ? "text-emerald-300"
                        : poseHint
                          ? "text-amber-300"
                          : "text-white/60",
                    )}
                  >
                    {guidedStatus === "stabilizing"
                      ? "Tahan posisi…"
                      : poseHint || "Hadapkan wajah ke kamera"}
                  </p>
                </div>
              </>
            ) : null}

            {captured ? (
              <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20">
                <span className="animate-bounce rounded-full bg-emerald-500 p-4 text-white">
                  <Check className="size-9" />
                </span>
              </div>
            ) : null}

            {timeout ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
                <p className="text-sm text-white">Wajah tidak terdeteksi</p>
                <Button size="sm" variant="secondary" onClick={retryGuidedStep}>
                  <RotateCcw />
                  Coba Lagi
                </Button>
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="text-destructive text-center text-sm">{error}</p>
          ) : null}
          <Button variant="ghost" className="self-center" onClick={exitCamera}>
            Kembali
          </Button>
        </CardContent>
      </Card>
    );
  }

  // STEP: Done
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CircleCheckBig className="size-5 text-emerald-500" />
          Pengambilan Wajah Selesai
        </CardTitle>
        <CardDescription>
          {captures.length} data wajah berhasil diproses. Simpan untuk
          menyelesaikan pendaftaran.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <div className="flex gap-2">
          <Button size="lg" onClick={saveDescriptors} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Check />}
            Simpan Data Wajah
          </Button>
          <Button variant="outline" onClick={resetAll} disabled={saving}>
            Ulangi
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
