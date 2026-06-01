"use client";

import * as faceapi from "@vladmandic/face-api";

/**
 * Wrapper face-api.js untuk modul absensi: load model, deteksi wajah,
 * validasi pose, deteksi kedip (liveness), dan konversi descriptor.
 *
 * Murni client-side — semua inferensi berjalan di browser, tidak ada
 * gambar wajah yang dikirim ke server (hanya descriptor 128 angka).
 */

let modelsLoaded = false;
let warmupDone = false;

export async function loadFaceApiModels(): Promise<void> {
  if (modelsLoaded) return;

  const MODEL_URL = "/models";

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);

  modelsLoaded = true;

  // Warmup: inferensi pertama selalu lambat (~1-2 dtk), jalankan di canvas kecil
  if (!warmupDone) {
    warmupDone = true;
    try {
      const c = document.createElement("canvas");
      c.width = 160;
      c.height = 120;
      await faceapi.detectSingleFace(c, tinyOptions);
    } catch {
      // abaikan error warmup
    }
  }
}

export function isModelsLoaded(): boolean {
  return modelsLoaded;
}

// Reuse options objects
// scoreThreshold lebih rendah (0.25) untuk deteksi lebih baik di perangkat mobile
const tinyOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 224,
  scoreThreshold: 0.25,
});
const ssdOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });

// Canvas offscreen reusable untuk downscale frame video
let offscreenCanvas: HTMLCanvasElement | null = null;
let offscreenCtx: CanvasRenderingContext2D | null = null;
const DOWNSCALE_MAX = 480; // maksimum untuk sisi terpanjang

function getDownscaledFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const vw = video.videoWidth || DOWNSCALE_MAX;
  const vh = video.videoHeight || DOWNSCALE_MAX;

  // Pertahankan aspect ratio — skala agar sisi terpanjang = DOWNSCALE_MAX
  const scale = Math.min(DOWNSCALE_MAX / vw, DOWNSCALE_MAX / vh);
  const dw = Math.round(vw * scale);
  const dh = Math.round(vh * scale);

  if (!offscreenCanvas) {
    offscreenCanvas = document.createElement("canvas");
    offscreenCtx = offscreenCanvas.getContext("2d", {
      willReadFrequently: true,
    });
  }

  if (offscreenCanvas.width !== dw || offscreenCanvas.height !== dh) {
    offscreenCanvas.width = dw;
    offscreenCanvas.height = dh;
  }

  offscreenCtx!.drawImage(video, 0, 0, dw, dh);
  return offscreenCanvas;
}

// Cek cepat: ada wajah? (~50ms dengan TinyFaceDetector)
export async function quickDetectFace(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<boolean> {
  const frame =
    input instanceof HTMLVideoElement ? getDownscaledFrame(input) : input;
  const detection = await faceapi.detectSingleFace(frame, tinyOptions);
  return !!detection;
}

// Deteksi cepat: TinyFaceDetector + landmark + descriptor (~80-150ms)
export async function detectFaceFast(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<faceapi.WithFaceDescriptor<
  faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>
> | null> {
  const frame =
    input instanceof HTMLVideoElement ? getDownscaledFrame(input) : input;

  const detection = await faceapi
    .detectSingleFace(frame, tinyOptions)
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection || null;
}

// Deteksi penuh: SSD MobileNet, lebih akurat (~300-500ms)
export async function detectFace(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<faceapi.WithFaceDescriptor<
  faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>
> | null> {
  const detection = await faceapi
    .detectSingleFace(input, ssdOptions)
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection || null;
}

export async function detectFaceFromImageUrl(
  url: string,
): Promise<faceapi.WithFaceDescriptor<
  faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>
> | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      const detection = await detectFace(img);
      resolve(detection);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function createFaceMatcher(
  labeledDescriptors: faceapi.LabeledFaceDescriptors[],
  threshold: number = 0.6,
): faceapi.FaceMatcher {
  return new faceapi.FaceMatcher(labeledDescriptors, threshold);
}

// Validasi pose wajah pakai 68-point landmark.
// Mengembalikan { valid, hint } — hint = teks bantuan saat pose belum sesuai.
export function validateFacePose(
  landmarks: faceapi.FaceLandmarks68,
  expectedPose: string,
): { valid: boolean; hint: string } {
  const pts = landmarks.positions;

  const leftEyeCenter = {
    x: (pts[36].x + pts[39].x) / 2,
    y: (pts[36].y + pts[39].y) / 2,
  };
  const rightEyeCenter = {
    x: (pts[42].x + pts[45].x) / 2,
    y: (pts[42].y + pts[45].y) / 2,
  };

  const noseTip = pts[30];

  const distToLeftEye = Math.hypot(
    noseTip.x - leftEyeCenter.x,
    noseTip.y - leftEyeCenter.y,
  );
  const distToRightEye = Math.hypot(
    noseTip.x - rightEyeCenter.x,
    noseTip.y - rightEyeCenter.y,
  );
  const ratio = distToLeftEye / distToRightEye;

  switch (expectedPose) {
    case "front":
      if (ratio > 1.15)
        return { valid: false, hint: "Wajah terlalu ke kiri, luruskan pandangan" };
      if (ratio < 0.85)
        return { valid: false, hint: "Wajah terlalu ke kanan, luruskan pandangan" };
      return { valid: true, hint: "" };

    case "left":
      if (ratio < 1.08)
        return { valid: false, hint: "Putar kepala sedikit ke kiri Anda" };
      return { valid: true, hint: "" };

    case "right":
      if (ratio > 0.92)
        return { valid: false, hint: "Putar kepala sedikit ke kanan Anda" };
      return { valid: true, hint: "" };

    case "smile": {
      const mouthWidth = Math.hypot(
        pts[54].x - pts[48].x,
        pts[54].y - pts[48].y,
      );
      const interOcular = Math.hypot(
        rightEyeCenter.x - leftEyeCenter.x,
        rightEyeCenter.y - leftEyeCenter.y,
      );
      const mouthRatio = mouthWidth / interOcular;
      if (mouthRatio < 0.52)
        return { valid: false, hint: "Tersenyum lebih lebar" };
      return { valid: true, hint: "" };
    }

    default:
      return { valid: true, hint: "" };
  }
}

// Eye Aspect Ratio (EAR) untuk deteksi kedip.
// Mata terbuka: EAR ≈ 0.25-0.35; tertutup (kedip): EAR < 0.2
export function computeEAR(landmarks: faceapi.FaceLandmarks68): number {
  const pts = landmarks.positions;
  const leftEAR = earForEye(
    pts[36],
    pts[37],
    pts[38],
    pts[39],
    pts[40],
    pts[41],
  );
  const rightEAR = earForEye(
    pts[42],
    pts[43],
    pts[44],
    pts[45],
    pts[46],
    pts[47],
  );
  return (leftEAR + rightEAR) / 2;
}

function earForEye(
  p1: faceapi.Point,
  p2: faceapi.Point,
  p3: faceapi.Point,
  p4: faceapi.Point,
  p5: faceapi.Point,
  p6: faceapi.Point,
): number {
  const vertical1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
  const vertical2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
  const horizontal = Math.hypot(p1.x - p4.x, p1.y - p4.y);
  if (horizontal === 0) return 0;
  return (vertical1 + vertical2) / (2 * horizontal);
}

export function descriptorToArray(descriptor: Float32Array): number[] {
  return Array.from(descriptor);
}

export function arrayToDescriptor(arr: number[]): Float32Array {
  return new Float32Array(arr);
}

export { faceapi };
