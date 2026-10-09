/**
 * Pembaca aman untuk bagian `InfluencerAudit.metrics` yang ditambahkan metode
 * penilaian v2. Audit lama tidak punya field-field ini, dan UI harus bisa
 * membedakan "tidak ada datanya" dari "nilainya nol".
 *
 * Murni (tanpa DB/React) supaya halaman daftar (server) dan detail (klien)
 * membaca JSON yang sama dengan cara yang sama.
 */

export type AuditTrustReason = {
  code: string;
  text: string;
  effect: "down" | "cap" | "hold" | "info";
};

export type AuditTrustView = {
  /** 1 = metode lama (tanpa rentang & keandalan). */
  scoringVersion: number;
  scoreInterval: [number, number] | null;
  erInterval: [number, number] | null;
  reliability: number | null;
  reliabilityFactors: Record<string, number> | null;
  peerPercentile: number | null;
  peerCount: number;
  peerMedianEr: number | null;
  staticBenchmarkEr: number | null;
  primaryMode: "single" | "blended" | null;
  adjustedEngagementRate: number | null;
  shrinkageWeight: number | null;
  dataCoverage: number | null;
  componentWeights: Record<string, number> | null;
  followerGrowth: { pct: number; days: number; previousFollowers: number } | null;
  verdictReasons: AuditTrustReason[];
};

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pair(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const a = num(value[0]);
  const b = num(value[1]);
  return a !== null && b !== null ? [a, b] : null;
}

function numberRecord(value: unknown): Record<string, number> | null {
  const o = obj(value);
  if (!o) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) {
    const n = num(v);
    if (n !== null) out[k] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

const REASON_EFFECTS = new Set(["down", "cap", "hold", "info"]);

export function readAuditTrust(metrics: unknown): AuditTrustView {
  const m = obj(metrics) ?? {};
  const peer = obj(m.peer);
  const growth = obj(m.followerGrowth);
  const reasons = Array.isArray(m.verdictReasons) ? m.verdictReasons : [];
  const mode = m.primaryMode;

  return {
    scoringVersion: num(m.scoringVersion) ?? 1,
    scoreInterval: pair(m.scoreInterval),
    erInterval: pair(m.erInterval),
    reliability: num(m.reliability),
    reliabilityFactors: numberRecord(m.reliabilityFactors),
    peerPercentile: peer ? num(peer.percentile) : null,
    peerCount: (peer && num(peer.n)) ?? 0,
    peerMedianEr: peer ? num(peer.medianEr) : null,
    staticBenchmarkEr: peer ? num(peer.staticBenchmarkEr) : null,
    primaryMode: mode === "single" || mode === "blended" ? mode : null,
    adjustedEngagementRate: num(m.adjustedEngagementRate),
    shrinkageWeight: num(m.shrinkageWeight),
    dataCoverage: num(m.dataCoverage),
    componentWeights: numberRecord(m.componentWeights),
    followerGrowth:
      growth &&
      num(growth.pct) !== null &&
      num(growth.days) !== null &&
      num(growth.previousFollowers) !== null
        ? {
            pct: growth.pct as number,
            days: growth.days as number,
            previousFollowers: growth.previousFollowers as number,
          }
        : null,
    verdictReasons: reasons.filter(
      (r): r is AuditTrustReason =>
        !!r &&
        typeof r === "object" &&
        typeof (r as AuditTrustReason).code === "string" &&
        typeof (r as AuditTrustReason).text === "string" &&
        REASON_EFFECTS.has((r as AuditTrustReason).effect),
    ),
  };
}

/** Label sentence-case untuk faktor keandalan, dipakai UI. */
export const RELIABILITY_FACTOR_LABEL: Record<string, string> = {
  sample: "Jumlah post terukur",
  measured: "Like yang terlihat",
  views: "Data view",
  freshness: "Kesegaran sampel",
  comments: "Contoh komentar",
  stability: "Konsisten dengan audit lalu",
};
