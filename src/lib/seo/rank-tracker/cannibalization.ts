/**
 * Deteksi keyword cannibalization dari data rank tracker — pure agar mudah
 * di-test:
 *  a) Flip-flop: `foundUrl` untuk satu keyword berganti-ganti antar snapshot
 *     (Google bingung memilih halaman) — bekerja dengan data existing.
 *  b) Multi-URL: ≥2 URL milik sendiri muncul di top-20 pada satu snapshot
 *     (`ownMatches`, tersedia sejak Rank Tracker v2).
 */

export type CannibalizationFinding = {
  keyword: string;
  urls: string[];
  severity: "high" | "medium";
  evidence: string;
};

export type KeywordSnapshotHistory = {
  keyword: string;
  /** Urut waktu naik. */
  snapshots: {
    foundUrl: string | null;
    ownMatches?: { position: number; url: string | null }[] | null;
  }[];
};

/** Minimal pergantian URL agar dianggap flip-flop. */
const MIN_URL_SWITCHES = 2;
/** Batas posisi untuk deteksi multi-URL. */
const MULTI_URL_MAX_POSITION = 20;

export function detectCannibalization(
  histories: KeywordSnapshotHistory[],
): CannibalizationFinding[] {
  const findings: CannibalizationFinding[] = [];

  for (const history of histories) {
    const urls = history.snapshots
      .map((s) => s.foundUrl)
      .filter((u): u is string => !!u);

    /* -------- (a) flip-flop URL antar snapshot -------- */
    const distinct = [...new Set(urls.map((u) => u.toLowerCase()))];
    if (distinct.length >= 2) {
      let switches = 0;
      for (let i = 1; i < urls.length; i++) {
        if (urls[i].toLowerCase() !== urls[i - 1].toLowerCase()) switches += 1;
      }
      if (switches >= MIN_URL_SWITCHES) {
        findings.push({
          keyword: history.keyword,
          urls: distinct,
          severity: "high",
          evidence: `URL ranking berganti ${switches}× antara ${distinct.length} halaman — Google bimbang memilih halaman.`,
        });
        continue; // temuan flip-flop sudah mencakup multi-URL
      }
    }

    /* -------- (b) ≥2 URL sendiri di top-20 satu snapshot -------- */
    const latest = history.snapshots[history.snapshots.length - 1];
    const matches = (latest?.ownMatches ?? [])
      .filter(
        (m): m is { position: number; url: string } =>
          m.url != null && m.position <= MULTI_URL_MAX_POSITION,
      );
    const distinctLatest = [...new Set(matches.map((m) => m.url.toLowerCase()))];
    if (distinctLatest.length >= 2) {
      findings.push({
        keyword: history.keyword,
        urls: distinctLatest,
        severity: "medium",
        evidence: `${distinctLatest.length} halaman sendiri sama-sama masuk top ${MULTI_URL_MAX_POSITION} (${matches
          .map((m) => `#${m.position}`)
          .join(", ")}) — saling berebut ranking.`,
      });
    }
  }

  return findings.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1,
  );
}
