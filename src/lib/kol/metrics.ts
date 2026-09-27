/**
 * Metrik performa post KOL — fungsi murni (aman untuk klien & tes).
 *
 * Definisi mengikuti praktik pasar (dan glosarium GroovingWave):
 * - CPV = biaya ÷ views; CPM = biaya ÷ (views ÷ 1000)
 * - View velocity = kenaikan views antar dua snapshot harian
 * - Peak velocity = kenaikan harian terbesar
 * - Decay = (puncak − kenaikan terakhir) ÷ puncak × 100
 * - FYP = views pernah ≥ ambang (default 1 juta)
 */

export type SnapshotPoint = {
  /** Hari WIB "YYYY-MM-DD". */
  day: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
};

export type PostMetrics = {
  latest: SnapshotPoint | null;
  /** Kenaikan views per hari, sejajar dengan snapshot (hari pertama = views awal). */
  velocity: { day: string; delta: number }[];
  peakVelocity: number | null;
  peakDay: string | null;
  timeToPeakHours: number | null;
  decayRate: number | null;
  isFyp: boolean;
  fypDay: string | null;
  /** Arah momentum: bandingkan kenaikan terakhir dengan sebelumnya. */
  momentum: "naik" | "turun" | "stabil" | null;
};

const DAY_MS = 86_400_000;

export function computePostMetrics(
  snapshots: SnapshotPoint[],
  opts: { fypThreshold: number; postedAt?: Date | string | null },
): PostMetrics {
  const points = [...snapshots].sort((a, b) => a.day.localeCompare(b.day));
  if (points.length === 0) {
    return {
      latest: null,
      velocity: [],
      peakVelocity: null,
      peakDay: null,
      timeToPeakHours: null,
      decayRate: null,
      isFyp: false,
      fypDay: null,
      momentum: null,
    };
  }

  // Views kumulatif tidak boleh turun; bila scraper sesekali membaca lebih
  // rendah, anggap datar (kenaikan 0) alih-alih negatif.
  const velocity = points.map((p, i) => ({
    day: p.day,
    delta: Math.max(0, i === 0 ? p.views : p.views - points[i - 1].views),
  }));

  let peakIdx = 0;
  velocity.forEach((v, i) => {
    if (v.delta > velocity[peakIdx].delta) peakIdx = i;
  });
  const peak = velocity[peakIdx];

  let timeToPeakHours: number | null = null;
  if (opts.postedAt) {
    const posted = new Date(opts.postedAt).getTime();
    // Snapshot hari D menangkap akumulasi sampai akhir hari D (WIB).
    const peakEnd = new Date(`${peak.day}T23:59:59+07:00`).getTime();
    timeToPeakHours = Math.max(0, Math.round((peakEnd - posted) / 3_600_000));
  }

  const last = velocity[velocity.length - 1];
  const decayRate =
    velocity.length >= 2 && peak.delta > 0
      ? Math.round(((peak.delta - last.delta) / peak.delta) * 1000) / 10
      : null;

  const fypPoint = points.find((p) => p.views >= opts.fypThreshold) ?? null;

  let momentum: PostMetrics["momentum"] = null;
  if (velocity.length >= 3) {
    const prev = velocity[velocity.length - 2].delta;
    if (last.delta > prev * 1.1) momentum = "naik";
    else if (last.delta < prev * 0.9) momentum = "turun";
    else momentum = "stabil";
  }

  return {
    latest: points[points.length - 1],
    velocity,
    peakVelocity: peak.delta,
    peakDay: peak.day,
    timeToPeakHours,
    decayRate,
    isFyp: fypPoint != null,
    fypDay: fypPoint?.day ?? null,
    momentum,
  };
}

export function cpv(cost: number, views: number | null | undefined): number | null {
  if (!views || views <= 0 || cost <= 0) return null;
  return cost / views;
}

export function cpm(cost: number, views: number | null | undefined): number | null {
  if (!views || views <= 0 || cost <= 0) return null;
  return cost / (views / 1000);
}

/** Views yang didapat untuk tiap Rp1.000 biaya. */
export function viewsPerThousandRupiah(
  cost: number,
  views: number | null | undefined,
): number | null {
  if (!views || cost <= 0) return null;
  return views / (cost / 1000);
}

export function engagementRate(p: {
  views: number;
  likes: number;
  comments: number;
  shares: number;
}): number | null {
  if (!p.views) return null;
  return ((p.likes + p.comments + p.shares) / p.views) * 100;
}

/** Selisih hari antara dua kunci hari "YYYY-MM-DD". */
export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY_MS);
}
