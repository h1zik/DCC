"use client";

/**
 * Latar "hidup" berbasis Canvas2D — universal (tak ada shader/WebGL/VAO/driver
 * quirk), tetap beranimasi & mengambil warna dari TOKEN TEMA aktif (prop `colors`).
 * Blob radial-gradient additive mengalir pelan di atas base gelap → aurora lembut.
 * DPR di-cap ≤2. Di-mount hanya saat gerbang animasi aktif (parent yang atur).
 */
import { useEffect, useRef } from "react";
import type { RGB } from "./theme-sampler";

type Blob = {
  cx: number;
  cy: number;
  r: number;
  sx: number;
  sy: number;
  ci: number;
  phase: number;
};

const BLOBS: Blob[] = [
  { cx: 0.25, cy: 0.35, r: 0.62, sx: 0.07, sy: 0.05, ci: 0, phase: 0 },
  { cx: 0.72, cy: 0.28, r: 0.55, sx: -0.06, sy: 0.08, ci: 1, phase: 1.7 },
  { cx: 0.5, cy: 0.75, r: 0.7, sx: 0.05, sy: -0.06, ci: 2, phase: 3.1 },
  { cx: 0.86, cy: 0.68, r: 0.5, sx: -0.08, sy: -0.045, ci: 3, phase: 4.6 },
];

function rgba(c: RGB | undefined, fallback: RGB, alpha: number): string {
  const v = c ?? fallback;
  return `rgba(${Math.round(v[0] * 255)},${Math.round(v[1] * 255)},${Math.round(v[2] * 255)},${alpha})`;
}

export default function CanvasAurora({
  colors,
  intensity = 1,
}: {
  colors: RGB[];
  intensity?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const colorsRef = useRef(colors);

  useEffect(() => {
    colorsRef.current = colors;
  }, [colors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const parent = canvas.parentElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 1;
    let h = 1;
    const resize = () => {
      w = parent?.clientWidth || canvas.clientWidth || 1;
      h = parent?.clientHeight || canvas.clientHeight || 1;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (parent) ro.observe(parent);

    let raf = 0;
    const draw = (ts: number) => {
      const cur = colorsRef.current;
      const t = ts * 0.001;

      // Base gelap bertema (agar teks overlay terbaca di tema apa pun).
      const base = cur[3] ?? [0.06, 0.07, 0.12];
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = rgba(
        [base[0] * 0.45, base[1] * 0.45, base[2] * 0.5],
        [0.03, 0.035, 0.06],
        1,
      );
      ctx.fillRect(0, 0, w, h);

      // Blob additive mengalir.
      ctx.globalCompositeOperation = "lighter";
      const maxR = Math.max(w, h);
      for (const b of BLOBS) {
        const x = (b.cx + Math.sin(t * b.sx + b.phase) * 0.14) * w;
        const y = (b.cy + Math.cos(t * b.sy + b.phase) * 0.14) * h;
        const r = b.r * maxR * (0.82 + 0.18 * Math.sin(t * 0.25 + b.phase));
        const c = cur[b.ci % (cur.length || 1)];
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba(c, [0.4, 0.45, 0.8], 0.5 * intensity));
        g.addColorStop(0.6, rgba(c, [0.4, 0.45, 0.8], 0.12 * intensity));
        g.addColorStop(1, rgba(c, [0.4, 0.45, 0.8], 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
