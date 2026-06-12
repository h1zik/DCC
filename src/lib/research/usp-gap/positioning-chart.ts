import "server-only";

export type PositioningPoint = {
  name: string;
  brand: string;
  x: number;
  y: number;
};

export type PositioningMapData = {
  axisX: string;
  axisY: string;
  points: PositioningPoint[];
};

export function normalizePositioningMap(
  raw: PositioningMapData | null | undefined,
): PositioningMapData {
  if (!raw || !Array.isArray(raw.points)) {
    return {
      axisX: "Harga",
      axisY: "Benefit",
      points: [],
    };
  }

  const points = raw.points
    .filter(
      (p) =>
        typeof p.name === "string" &&
        typeof p.x === "number" &&
        typeof p.y === "number",
    )
    .map((p) => ({
      name: p.name,
      brand: typeof p.brand === "string" ? p.brand : p.name,
      x: Math.max(0, Math.min(100, p.x)),
      y: Math.max(0, Math.min(100, p.y)),
    }));

  return {
    axisX: raw.axisX || "Harga",
    axisY: raw.axisY || "Benefit",
    points,
  };
}
