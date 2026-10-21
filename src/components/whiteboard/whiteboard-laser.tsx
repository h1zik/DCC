"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Point } from "@/lib/whiteboard/geometry";

const LASER_TTL_MS = 900;

// ---------------------------------------------------------------------------
// Laser pointer
// ---------------------------------------------------------------------------

export type LaserPoint = { x: number; y: number; t: number };

/**
 * Jejak laser yang memudar. Titik disimpan di ref dan sebuah loop
 * `requestAnimationFrame` hanya berjalan selama masih ada jejak yang tampil.
 */
export function useLaserTrail() {
  const pointsRef = useRef<LaserPoint[]>([]);
  const frameRef = useRef<number | null>(null);
  const [trail, setTrail] = useState<{ points: LaserPoint[]; now: number }>({
    points: [],
    now: 0,
  });

  const push = useCallback((point: Point) => {
    pointsRef.current.push({ ...point, t: performance.now() });
    if (pointsRef.current.length > 120) pointsRef.current.shift();
    if (frameRef.current !== null) return;
    const tick = () => {
      const cutoff = performance.now() - LASER_TTL_MS;
      pointsRef.current = pointsRef.current.filter((p) => p.t >= cutoff);
      setTrail({ points: [...pointsRef.current], now: performance.now() });
      frameRef.current =
        pointsRef.current.length > 0 ? requestAnimationFrame(tick) : null;
    };
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  return useMemo(() => ({ push, trail }), [push, trail]);
}

export function LaserTrail({
  points,
  now,
  color,
}: {
  points: LaserPoint[];
  /** Waktu acuan pemudaran (dari loop animasi, bukan dibaca saat render). */
  now: number;
  color: string;
}) {
  if (points.length < 2) return null;
  return (
    <g style={{ pointerEvents: "none" }}>
      {points.slice(1).map((point, index) => {
        const prev = points[index]!;
        const life = Math.max(0, 1 - (now - point.t) / LASER_TTL_MS);
        return (
          <line
            key={point.t + index}
            x1={prev.x}
            y1={prev.y}
            x2={point.x}
            y2={point.y}
            stroke={color}
            strokeWidth={1.5 + life * 4}
            strokeOpacity={life * 0.9}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </g>
  );
}

/** Jejak laser peserta lain, dibangun dari rentetan posisi kursornya. */
export function RemoteLaser({
  cursor,
  color,
}: {
  cursor: Point | null;
  color: string;
}) {
  const { push, trail } = useLaserTrail();
  const x = cursor?.x;
  const y = cursor?.y;
  useEffect(() => {
    if (x !== undefined && y !== undefined) push({ x, y });
  }, [x, y, push]);
  return <LaserTrail points={trail.points} now={trail.now} color={color} />;
}
