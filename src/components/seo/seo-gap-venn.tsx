"use client";

/**
 * Venn sederhana (SVG hand-rolled) untuk Keyword Gap: lingkaran target di
 * tengah + lingkaran kompetitor yang tumpang tindih. Ukuran ∝ √jumlah keyword.
 * Ilustratif (bukan proporsi irisan eksak) — angka pasti ada di ringkasan bucket.
 */

const COLORS = [
  "var(--chart-1)",
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--chart-3)",
];

export function SeoGapVenn({
  target,
  targetCount,
  competitors,
}: {
  target: string;
  targetCount: number;
  competitors: { domain: string; count: number }[];
}) {
  const width = 420;
  const height = 260;
  const cx = width / 2 - 40;
  const cy = height / 2;

  const maxCount = Math.max(targetCount, ...competitors.map((c) => c.count), 1);
  const radius = (count: number) =>
    18 + Math.sqrt(Math.max(count, 1) / maxCount) * 55;

  const rTarget = radius(targetCount);
  // Posisi kompetitor mengitari target dengan overlap.
  const angles = [-30, 30, 90];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full max-w-md"
      role="img"
      aria-label="Diagram tumpang tindih keyword"
    >
      {competitors.map((c, i) => {
        const r = radius(c.count);
        const angle = ((angles[i % angles.length] ?? 0) * Math.PI) / 180;
        const dist = rTarget + r - Math.min(rTarget, r) * 0.9;
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;
        const color = COLORS[(i + 1) % COLORS.length];
        return (
          <g key={c.domain}>
            <circle cx={x} cy={y} r={r} fill={color} fillOpacity={0.25} stroke={color} />
            <text
              x={x + r * 0.4}
              y={y - r * 0.6}
              fontSize="11"
              className="fill-current"
            >
              {c.domain} ({c.count})
            </text>
          </g>
        );
      })}
      <circle
        cx={cx}
        cy={cy}
        r={rTarget}
        fill={COLORS[0]}
        fillOpacity={0.3}
        stroke={COLORS[0]}
        strokeWidth={1.5}
      />
      <text x={cx - rTarget * 0.6} y={cy} fontSize="12" fontWeight={600} className="fill-current">
        {target}
      </text>
      <text x={cx - rTarget * 0.6} y={cy + 14} fontSize="11" className="fill-current opacity-70">
        {targetCount} keyword
      </text>
    </svg>
  );
}
