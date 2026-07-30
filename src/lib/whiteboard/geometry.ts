import { RoomWhiteboardElementType } from "@prisma/client";
import { LINEAR_TYPES, type WhiteboardElement } from "./types";

/**
 * Utilitas geometri kanvas: kotak pembatas, uji tumbukan (hit-test),
 * transformasi viewport, resize dengan handle, rotasi, dan snapping.
 *
 * Semua fungsi di sini murni (tanpa efek samping) supaya mudah diuji dan
 * bisa dipakai di server saat membuat thumbnail atau mengekspor.
 */

export type Point = { x: number; y: number };

export type Box = { x: number; y: number; width: number; height: number };

export type Viewport = {
  /** Geseran kanvas dalam piksel layar. */
  x: number;
  y: number;
  /** Faktor zoom (1 = 100%). */
  zoom: number;
};

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 8;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function screenToWorld(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  };
}

export function worldToScreen(point: Point, viewport: Viewport): Point {
  return {
    x: point.x * viewport.zoom + viewport.x,
    y: point.y * viewport.zoom + viewport.y,
  };
}

/** Zoom di sekitar sebuah titik layar sehingga titik itu tetap di tempatnya. */
export function zoomAt(
  viewport: Viewport,
  screenPoint: Point,
  nextZoom: number,
): Viewport {
  const zoom = clampZoom(nextZoom);
  const world = screenToWorld(screenPoint, viewport);
  return {
    zoom,
    x: screenPoint.x - world.x * zoom,
    y: screenPoint.y - world.y * zoom,
  };
}

// ---------------------------------------------------------------------------
// Kotak pembatas
// ---------------------------------------------------------------------------

/** Kotak pembatas elemen sebelum rotasi (koordinat lokal world). */
export function elementBox(element: WhiteboardElement): Box {
  return {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  };
}

export function boxCenter(box: Box): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export function rotatePoint(point: Point, origin: Point, angle: number): Point {
  if (!angle) return point;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/** Empat sudut elemen setelah rotasi. */
export function elementCorners(element: WhiteboardElement): Point[] {
  const box = elementBox(element);
  const center = boxCenter(box);
  const corners: Point[] = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ];
  if (!element.rotation) return corners;
  return corners.map((c) => rotatePoint(c, center, element.rotation));
}

/**
 * Kotak pembatas sejajar sumbu yang mencakup elemen (termasuk rotasinya).
 *
 * Garis dan panah bisa punya lebar/tinggi negatif — itu wajar, karena
 * `width`/`height` mereka adalah vektor dari titik awal ke titik akhir.
 * Kotak pembatas selalu dinormalisasi supaya perhitungan seleksi, marquee,
 * dan peta mini tetap benar.
 */
export function elementAABB(element: WhiteboardElement): Box {
  if (!element.rotation) return normalizeBounds(elementBox(element));
  const corners = elementCorners(element);
  return boundsOfPoints(corners);
}

/** Ubah kotak berdimensi negatif jadi kotak setara dengan dimensi positif. */
export function normalizeBounds(box: Box): Box {
  if (box.width >= 0 && box.height >= 0) return box;
  return {
    x: box.width < 0 ? box.x + box.width : box.x,
    y: box.height < 0 ? box.y + box.height : box.y,
    width: Math.abs(box.width),
    height: Math.abs(box.height),
  };
}

export function boundsOfPoints(points: Point[]): Box {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Gabungan kotak pembatas beberapa elemen. */
export function elementsBounds(elements: WhiteboardElement[]): Box | null {
  if (elements.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    const box = elementAABB(el);
    if (box.x < minX) minX = box.x;
    if (box.y < minY) minY = box.y;
    if (box.x + box.width > maxX) maxX = box.x + box.width;
    if (box.y + box.height > maxY) maxY = box.y + box.height;
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function expandBox(box: Box, padding: number): Box {
  return {
    x: box.x - padding,
    y: box.y - padding,
    width: box.width + padding * 2,
    height: box.height + padding * 2,
  };
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function boxContains(outer: Box, inner: Box): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

export function pointInBox(point: Point, box: Box): boolean {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  );
}

// ---------------------------------------------------------------------------
// Hit-test
// ---------------------------------------------------------------------------

const LINE_HIT_SLOP = 8;

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Apakah titik `point` (koordinat world) mengenai elemen?
 * `tolerance` diberikan dalam satuan world agar toleransi tetap konsisten
 * di semua level zoom.
 */
export function hitTestElement(
  element: WhiteboardElement,
  point: Point,
  tolerance = 0,
): boolean {
  // Balik rotasi titik agar bisa diuji terhadap kotak lokal.
  const center = boxCenter(elementBox(element));
  const local = element.rotation
    ? rotatePoint(point, center, -element.rotation)
    : point;

  if (LINEAR_TYPES.has(element.type)) {
    const a = { x: element.x, y: element.y };
    const b = { x: element.x + element.width, y: element.y + element.height };
    return distanceToSegment(local, a, b) <= LINE_HIT_SLOP + tolerance;
  }

  if (element.type === RoomWhiteboardElementType.DRAW) {
    const points = element.props.points ?? [];
    if (points.length === 0) return false;
    const slop = (element.props.strokeWidth ?? 4) / 2 + LINE_HIT_SLOP + tolerance;
    for (let i = 1; i < points.length; i += 1) {
      const a = { x: element.x + points[i - 1]![0], y: element.y + points[i - 1]![1] };
      const b = { x: element.x + points[i]![0], y: element.y + points[i]![1] };
      if (distanceToSegment(local, a, b) <= slop) return true;
    }
    // Coretan satu titik.
    if (points.length === 1) {
      const only = { x: element.x + points[0]![0], y: element.y + points[0]![1] };
      return Math.hypot(local.x - only.x, local.y - only.y) <= slop;
    }
    return false;
  }

  const box = expandBox(elementBox(element), tolerance);

  if (element.type === RoomWhiteboardElementType.ELLIPSE) {
    const rx = box.width / 2;
    const ry = box.height / 2;
    if (rx <= 0 || ry <= 0) return false;
    const cx = box.x + rx;
    const cy = box.y + ry;
    const nx = (local.x - cx) / rx;
    const ny = (local.y - cy) / ry;
    return nx * nx + ny * ny <= 1;
  }

  if (element.type === RoomWhiteboardElementType.DIAMOND) {
    const rx = box.width / 2;
    const ry = box.height / 2;
    if (rx <= 0 || ry <= 0) return false;
    const cx = box.x + rx;
    const cy = box.y + ry;
    return Math.abs(local.x - cx) / rx + Math.abs(local.y - cy) / ry <= 1;
  }

  if (element.type === RoomWhiteboardElementType.TRIANGLE) {
    if (!pointInBox(local, box)) return false;
    // Segitiga sama kaki dengan puncak di tengah atas.
    const t = (local.y - box.y) / (box.height || 1);
    const halfWidth = (box.width / 2) * t;
    const cx = box.x + box.width / 2;
    return Math.abs(local.x - cx) <= halfWidth;
  }

  if (element.type === RoomWhiteboardElementType.FRAME) {
    // Frame hanya bisa diseleksi lewat tepi atau labelnya, supaya elemen di
    // dalamnya tetap mudah diklik (perilaku yang sama dengan Figma).
    if (!pointInBox(local, expandBox(box, LINE_HIT_SLOP))) return false;
    const inner = expandBox(box, -LINE_HIT_SLOP);
    const onEdge = !pointInBox(local, inner);
    const onLabel =
      local.y >= box.y - 28 && local.y <= box.y && local.x >= box.x && local.x <= box.x + box.width;
    return onEdge || onLabel;
  }

  return pointInBox(local, box);
}

/** Elemen paling atas yang kena klik. Daftar harus urut z-index menaik. */
export function pickElement(
  elements: WhiteboardElement[],
  point: Point,
  tolerance = 0,
): WhiteboardElement | null {
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    const el = elements[i]!;
    if (el.locked) continue;
    if (hitTestElement(el, point, tolerance)) return el;
  }
  return null;
}

/** Semua elemen yang bersinggungan dengan kotak seleksi (marquee). */
export function pickElementsInBox(
  elements: WhiteboardElement[],
  box: Box,
  /** `true` = hanya yang sepenuhnya di dalam kotak. */
  requireFullyInside = false,
): WhiteboardElement[] {
  return elements.filter((el) => {
    if (el.locked) return false;
    const aabb = elementAABB(el);
    return requireFullyInside
      ? boxContains(box, aabb)
      : boxesIntersect(box, aabb);
  });
}

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------

export const RESIZE_HANDLES = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
] as const;

export type ResizeHandle = (typeof RESIZE_HANDLES)[number];

export function handleCursor(handle: ResizeHandle, rotation: number): string {
  // Putar arah kursor mengikuti rotasi elemen agar terasa alami.
  const base: Record<ResizeHandle, number> = {
    n: 0,
    ne: 45,
    e: 90,
    se: 135,
    s: 180,
    sw: 225,
    w: 270,
    nw: 315,
  };
  const deg = (base[handle] + (rotation * 180) / Math.PI + 360) % 360;
  const names = [
    "ns-resize",
    "nesw-resize",
    "ew-resize",
    "nwse-resize",
  ];
  const idx = Math.round(deg / 45) % 4;
  return names[idx]!;
}

export const MIN_ELEMENT_SIZE = 8;

/**
 * Hitung kotak baru saat sebuah handle ditarik.
 * `origin` adalah kotak sebelum resize, `delta` adalah pergeseran pointer
 * dalam koordinat lokal (sudah dibalik rotasinya).
 */
export function resizeBox(
  origin: Box,
  handle: ResizeHandle,
  delta: Point,
  options: { keepAspect?: boolean; fromCenter?: boolean } = {},
): Box {
  const { keepAspect = false, fromCenter = false } = options;
  let { x, y, width, height } = origin;

  const west = handle.includes("w");
  const east = handle.includes("e");
  const north = handle.startsWith("n");
  const south = handle.startsWith("s");

  const scale = fromCenter ? 2 : 1;

  if (east) width = origin.width + delta.x * scale;
  if (west) width = origin.width - delta.x * scale;
  if (south) height = origin.height + delta.y * scale;
  if (north) height = origin.height - delta.y * scale;

  if (keepAspect && origin.width > 0 && origin.height > 0) {
    const ratio = origin.width / origin.height;
    const corner = (east || west) && (north || south);
    if (corner) {
      // Ambil dimensi yang berubah paling besar sebagai acuan.
      if (Math.abs(width - origin.width) >= Math.abs(height - origin.height)) {
        height = width / ratio;
      } else {
        width = height * ratio;
      }
    } else if (east || west) {
      height = width / ratio;
    } else {
      width = height * ratio;
    }
  }

  width = Math.max(MIN_ELEMENT_SIZE, width);
  height = Math.max(MIN_ELEMENT_SIZE, height);

  if (fromCenter) {
    const cx = origin.x + origin.width / 2;
    const cy = origin.y + origin.height / 2;
    x = cx - width / 2;
    y = cy - height / 2;
    return { x, y, width, height };
  }

  if (west) x = origin.x + origin.width - width;
  if (north) y = origin.y + origin.height - height;
  // Handle sisi tunggal dengan aspect ratio ikut menggeser sumbu lainnya
  // supaya tetap terpusat.
  if (keepAspect && (east || west) && !north && !south) {
    y = origin.y + (origin.height - height) / 2;
  }
  if (keepAspect && (north || south) && !east && !west) {
    x = origin.x + (origin.width - width) / 2;
  }

  return { x, y, width, height };
}

/**
 * Terapkan hasil resize kotak grup ke satu elemen anggotanya secara
 * proporsional.
 */
export function scaleElementWithinBox(
  element: WhiteboardElement,
  before: Box,
  after: Box,
): { x: number; y: number; width: number; height: number } {
  const sx = before.width === 0 ? 1 : after.width / before.width;
  const sy = before.height === 0 ? 1 : after.height / before.height;
  const width = element.width * sx;
  const height = element.height * sy;

  // Garis/panah: `width`/`height` adalah vektor arah, jadi tandanya harus
  // dipertahankan dan nol tetap boleh (garis lurus vertikal/horizontal).
  // Bentuk lain dijaga agar tidak mengecil sampai tak bisa diklik lagi.
  const linear = LINEAR_TYPES.has(element.type);

  return {
    x: after.x + (element.x - before.x) * sx,
    y: after.y + (element.y - before.y) * sy,
    width: linear ? width : Math.max(MIN_ELEMENT_SIZE, width),
    height: linear ? height : Math.max(MIN_ELEMENT_SIZE, height),
  };
}

// ---------------------------------------------------------------------------
// Snapping & panduan perataan
// ---------------------------------------------------------------------------

export type SnapGuide = {
  axis: "x" | "y";
  /** Posisi garis panduan di koordinat world. */
  position: number;
  /** Rentang yang dicakup garis, untuk menggambar panduan sependek mungkin. */
  start: number;
  end: number;
};

export type SnapResult = {
  dx: number;
  dy: number;
  guides: SnapGuide[];
};

/**
 * Cari penyesuaian posisi terdekat agar kotak yang sedang digeser sejajar
 * dengan elemen lain (tepi kiri/tengah/kanan dan atas/tengah/bawah).
 *
 * `threshold` dalam satuan world — panggil dengan `SNAP_PX / zoom` supaya
 * jarak tarik terasa sama di semua level zoom.
 */
export function computeSnap(
  moving: Box,
  others: Box[],
  threshold: number,
): SnapResult {
  if (others.length === 0 || threshold <= 0) {
    return { dx: 0, dy: 0, guides: [] };
  }

  const movingX = [moving.x, moving.x + moving.width / 2, moving.x + moving.width];
  const movingY = [moving.y, moving.y + moving.height / 2, moving.y + moving.height];

  let bestX: { delta: number; position: number; other: Box } | null = null;
  let bestY: { delta: number; position: number; other: Box } | null = null;

  for (const other of others) {
    const otherX = [other.x, other.x + other.width / 2, other.x + other.width];
    const otherY = [other.y, other.y + other.height / 2, other.y + other.height];

    for (const mx of movingX) {
      for (const ox of otherX) {
        const delta = ox - mx;
        if (Math.abs(delta) > threshold) continue;
        if (!bestX || Math.abs(delta) < Math.abs(bestX.delta)) {
          bestX = { delta, position: ox, other };
        }
      }
    }
    for (const my of movingY) {
      for (const oy of otherY) {
        const delta = oy - my;
        if (Math.abs(delta) > threshold) continue;
        if (!bestY || Math.abs(delta) < Math.abs(bestY.delta)) {
          bestY = { delta, position: oy, other };
        }
      }
    }
  }

  const guides: SnapGuide[] = [];
  if (bestX) {
    guides.push({
      axis: "x",
      position: bestX.position,
      start: Math.min(moving.y, bestX.other.y),
      end: Math.max(moving.y + moving.height, bestX.other.y + bestX.other.height),
    });
  }
  if (bestY) {
    guides.push({
      axis: "y",
      position: bestY.position,
      start: Math.min(moving.x, bestY.other.x),
      end: Math.max(moving.x + moving.width, bestY.other.x + bestY.other.width),
    });
  }

  return { dx: bestX?.delta ?? 0, dy: bestY?.delta ?? 0, guides };
}

/** Bulatkan sudut rotasi ke kelipatan 15° saat Shift ditahan. */
export function snapAngle(angle: number, step = Math.PI / 12): number {
  return Math.round(angle / step) * step;
}

// ---------------------------------------------------------------------------
// Konektor
// ---------------------------------------------------------------------------

/**
 * Titik tempel konektor pada sebuah elemen. `auto` memilih sisi yang paling
 * dekat ke titik acuan lawannya.
 */
export function anchorPoint(
  element: WhiteboardElement,
  side: string,
  towards: Point,
): Point {
  const box = elementAABB(element);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  let resolved = side;
  if (side === "auto" || !side) {
    const dx = towards.x - cx;
    const dy = towards.y - cy;
    // Bandingkan dalam ruang ternormalisasi agar kotak lebar tidak selalu
    // memilih sisi kiri/kanan.
    const nx = box.width === 0 ? dx : dx / box.width;
    const ny = box.height === 0 ? dy : dy / box.height;
    if (Math.abs(nx) > Math.abs(ny)) resolved = nx > 0 ? "right" : "left";
    else resolved = ny > 0 ? "bottom" : "top";
  }

  switch (resolved) {
    case "top":
      return { x: cx, y: box.y };
    case "bottom":
      return { x: cx, y: box.y + box.height };
    case "left":
      return { x: box.x, y: cy };
    case "right":
      return { x: box.x + box.width, y: cy };
    default:
      return { x: cx, y: cy };
  }
}

/** Jalur elbow ortogonal sederhana antara dua titik. */
export function elbowPath(a: Point, b: Point): Point[] {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  if (dx < 1 || dy < 1) return [a, b];
  // Belok dulu di sumbu dominan agar jalurnya terlihat rapi.
  if (dx >= dy) {
    const mid = (a.x + b.x) / 2;
    return [a, { x: mid, y: a.y }, { x: mid, y: b.y }, b];
  }
  const mid = (a.y + b.y) / 2;
  return [a, { x: a.x, y: mid }, { x: b.x, y: mid }, b];
}

/** Ubah deretan titik jadi `d` SVG, opsional dengan sudut membulat. */
export function pointsToPath(points: Point[], radius = 0): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;
  if (radius <= 0 || points.length === 2) {
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${round(p.x)} ${round(p.y)}`)
      .join(" ");
  }

  let d = `M ${round(points[0]!.x)} ${round(points[0]!.y)}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    const next = points[i + 1]!;
    const r = Math.min(
      radius,
      Math.hypot(cur.x - prev.x, cur.y - prev.y) / 2,
      Math.hypot(next.x - cur.x, next.y - cur.y) / 2,
    );
    const from = lerpTowards(cur, prev, r);
    const to = lerpTowards(cur, next, r);
    d += ` L ${round(from.x)} ${round(from.y)} Q ${round(cur.x)} ${round(cur.y)} ${round(to.x)} ${round(to.y)}`;
  }
  const last = points[points.length - 1]!;
  d += ` L ${round(last.x)} ${round(last.y)}`;
  return d;
}

function lerpTowards(from: Point, to: Point, distance: number): Point {
  const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const t = Math.min(1, distance / len);
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Coretan bebas
// ---------------------------------------------------------------------------

/**
 * Ubah titik-titik coretan jadi kurva halus (Catmull-Rom disederhanakan jadi
 * quadratic) supaya goresan tidak terlihat patah-patah.
 */
export function strokeToPath(points: [number, number, number][]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const [x, y] = points[0]!;
    return `M ${round(x)} ${round(y)} L ${round(x + 0.1)} ${round(y)}`;
  }
  let d = `M ${round(points[0]![0])} ${round(points[0]![1])}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    d += ` Q ${round(x0)} ${round(y0)} ${round((x0 + x1) / 2)} ${round((y0 + y1) / 2)}`;
  }
  const last = points[points.length - 1]!;
  d += ` L ${round(last[0])} ${round(last[1])}`;
  return d;
}

/**
 * Kurangi kepadatan titik coretan (Ramer–Douglas–Peucker sederhana) agar
 * payload sinkron dan ukuran DB tetap kecil tanpa mengubah bentuk.
 */
export function simplifyStroke(
  points: [number, number, number][],
  tolerance = 0.6,
): [number, number, number][] {
  if (points.length <= 2) return points;

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    if (end - start < 2) continue;
    let maxDist = 0;
    let index = -1;
    const a = { x: points[start]![0], y: points[start]![1] };
    const b = { x: points[end]![0], y: points[end]![1] };
    for (let i = start + 1; i < end; i += 1) {
      const p = { x: points[i]![0], y: points[i]![1] };
      const dist = distanceToSegment(p, a, b);
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }
    if (maxDist > tolerance && index > 0) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }

  const out: [number, number, number][] = [];
  for (let i = 0; i < points.length; i += 1) {
    if (keep[i]) out.push(points[i]!);
  }
  return out;
}
