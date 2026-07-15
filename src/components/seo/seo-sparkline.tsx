import { cn } from "@/lib/utils";

/**
 * Sparkline SVG ringan (tanpa lib chart) untuk tren mini di tile & tabel.
 * Mewarisi warna dari `currentColor`. `invert` untuk metrik "kecil = baik"
 * (posisi ranking). Nilai `null` dilewati; garis menyambung antar titik valid.
 */
export function SeoSparkline({
  values,
  invert = false,
  showArea = true,
  className,
}: {
  values: (number | null)[];
  invert?: boolean;
  showArea?: boolean;
  className?: string;
}) {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2) return null;

  let min = Math.min(...nums);
  let max = Math.max(...nums);
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const W = 100;
  const H = 32;
  const PAD = 3;
  const n = values.length;
  const pts: { x: number; y: number }[] = [];
  values.forEach((v, i) => {
    if (v == null) return;
    const x = n === 1 ? W / 2 : (i / (n - 1)) * W;
    const t = (v - min) / (max - min);
    const yNorm = invert ? t : 1 - t;
    pts.push({ x, y: PAD + yNorm * (H - PAD * 2) });
  });

  const line = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${pts[pts.length - 1].x.toFixed(2)},${H} L${pts[0].x.toFixed(2)},${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("h-8 w-full", className)}
      aria-hidden
    >
      {showArea ? (
        <path d={area} fill="currentColor" opacity={0.14} stroke="none" />
      ) : null}
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
