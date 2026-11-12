import { maxKey, minKey, rangesOverlap, type DayKey } from "./dates";

/**
 * Susunan batang (campaign, aktivitas multi-hari) di grid bulan. Satu rentang
 * dipotong per baris minggu, lalu tiap potongan ditaruh di lajur paling atas
 * yang masih kosong supaya tidak ada yang bertumpuk. Murni.
 */

export type Span = {
  id: string;
  start: DayKey;
  end: DayKey;
};

export type WeekSegment = {
  id: string;
  /** Kolom pertama & terakhir dalam minggu (0 = Senin … 6 = Minggu), inklusif. */
  colStart: number;
  colEnd: number;
  lane: number;
  /** Rentang sudah dimulai sebelum minggu ini → ujung kiri tidak dibulatkan. */
  continuesBefore: boolean;
  /** Rentang berlanjut ke minggu berikutnya → ujung kanan tidak dibulatkan. */
  continuesAfter: boolean;
};

export type WeekLayout = {
  segments: WeekSegment[];
  /** Potongan yang tidak muat di `maxLanes`, dihitung per kolom hari. */
  hiddenByCol: number[];
  laneCount: number;
};

/**
 * @param week tujuh kunci hari berurutan (Senin → Minggu)
 * @param spans urutan masukan menentukan prioritas saat seri (mis. campaign
 *   yang mulai lebih dulu menempati lajur lebih atas)
 */
export function layoutWeek(
  week: readonly DayKey[],
  spans: readonly Span[],
  maxLanes = Number.POSITIVE_INFINITY,
): WeekLayout {
  const weekStart = week[0]!;
  const weekEnd = week[week.length - 1]!;
  const hiddenByCol = week.map(() => 0);

  const inWeek = spans
    .map((span, order) => ({ span, order }))
    .filter(({ span }) => rangesOverlap(span.start, span.end, weekStart, weekEnd))
    .sort((a, b) => {
      if (a.span.start !== b.span.start) return a.span.start < b.span.start ? -1 : 1;
      // Mulai bersamaan: yang lebih panjang dulu supaya batang panjang stabil di atas.
      if (a.span.end !== b.span.end) return a.span.end > b.span.end ? -1 : 1;
      return a.order - b.order;
    });

  /** Kolom terakhir yang terisi per lajur. */
  const laneEnds: number[] = [];
  const segments: WeekSegment[] = [];

  for (const { span } of inWeek) {
    const colStart = week.indexOf(maxKey(span.start, weekStart));
    const colEnd = week.indexOf(minKey(span.end, weekEnd));
    if (colStart < 0 || colEnd < 0) continue;

    let lane = laneEnds.findIndex((end) => end < colStart);
    if (lane === -1) lane = laneEnds.length;

    if (lane >= maxLanes) {
      for (let c = colStart; c <= colEnd; c++) hiddenByCol[c]! += 1;
      continue;
    }

    laneEnds[lane] = colEnd;
    segments.push({
      id: span.id,
      colStart,
      colEnd,
      lane,
      continuesBefore: span.start < weekStart,
      continuesAfter: span.end > weekEnd,
    });
  }

  return { segments, hiddenByCol, laneCount: laneEnds.length };
}

/**
 * Lajur untuk linimasa: tiap rentang satu baris, kecuali yang tidak pernah
 * beririsan boleh berbagi baris. Dipakai untuk memadatkan titik aktivitas.
 */
export function packLanes(spans: readonly Span[]): Map<string, number> {
  const sorted = [...spans].sort((a, b) =>
    a.start === b.start ? (a.end < b.end ? -1 : 1) : a.start < b.start ? -1 : 1,
  );
  const laneEnds: DayKey[] = [];
  const out = new Map<string, number>();
  for (const span of sorted) {
    let lane = laneEnds.findIndex((end) => end < span.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = span.end;
    out.set(span.id, lane);
  }
  return out;
}
