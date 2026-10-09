"use client";

import { useState, useTransition } from "react";
import {
  Clapperboard,
  ExternalLink,
  Eye,
  Heart,
  LayoutGrid,
  Megaphone,
  MessageCircle,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { updateInfluencerNotes } from "@/actions/brand-influencer";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { lab } from "@/components/lab/lab-primitives";
import { compactNumber, PostThumbnail } from "@/components/brand-hub/influencer-badges";
import { cn } from "@/lib/utils";
import type { AuditView, PostView } from "./types";

export type Narrative = {
  strengths?: string[];
  risks?: string[];
  recommendation?: string;
};

export function readNarrative(metrics: unknown): Narrative | null {
  if (!metrics || typeof metrics !== "object") return null;
  const n = (metrics as { narrative?: unknown }).narrative;
  if (!n || typeof n !== "object") return null;
  return n as Narrative;
}

export function readNumber(metrics: unknown, key: string): number | null {
  if (!metrics || typeof metrics !== "object") return null;
  const v = (metrics as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function readString(metrics: unknown, key: string): string | null {
  if (!metrics || typeof metrics !== "object") return null;
  const v = (metrics as Record<string, unknown>)[key];
  return typeof v === "string" ? v : null;
}

export function readBoolean(metrics: unknown, key: string): boolean | null {
  if (!metrics || typeof metrics !== "object") return null;
  const v = (metrics as Record<string, unknown>)[key];
  return typeof v === "boolean" ? v : null;
}

export type BrandSafetyHitView = {
  category: string;
  severity: "high" | "medium" | "low";
  label: string;
  why: string;
  terms: string[];
  postCount: number;
  daysSinceLatest: number | null;
  sampleUrls: string[];
};

export function readBrandSafety(metrics: unknown): BrandSafetyHitView[] {
  if (!metrics || typeof metrics !== "object") return [];
  const bs = (metrics as { brandSafety?: unknown }).brandSafety;
  if (!bs || typeof bs !== "object") return [];
  const hits = (bs as { hits?: unknown }).hits;
  if (!Array.isArray(hits)) return [];
  return hits.filter(
    (h): h is BrandSafetyHitView =>
      !!h &&
      typeof h === "object" &&
      typeof (h as BrandSafetyHitView).label === "string" &&
      typeof (h as BrandSafetyHitView).postCount === "number" &&
      ["high", "medium", "low"].includes((h as BrandSafetyHitView).severity),
  );
}

export type CommentQualityView = {
  analyzedComments: number;
  postsWithComments: number;
  lowSubstanceShare: number;
  duplicateShare: number;
  foreignScriptShare: number;
  spamShare: number;
  repeatAuthorShare: number;
};

export function readCommentQuality(metrics: unknown): CommentQualityView | null {
  if (!metrics || typeof metrics !== "object") return null;
  const q = (metrics as { commentQuality?: unknown }).commentQuality;
  if (!q || typeof q !== "object") return null;
  const o = q as Record<string, unknown>;
  if (typeof o.analyzedComments !== "number") return null;
  const pick = (key: string): number =>
    typeof o[key] === "number" && Number.isFinite(o[key]) ? (o[key] as number) : 0;
  return {
    analyzedComments: o.analyzedComments,
    postsWithComments: pick("postsWithComments"),
    lowSubstanceShare: pick("lowSubstanceShare"),
    duplicateShare: pick("duplicateShare"),
    foreignScriptShare: pick("foreignScriptShare"),
    spamShare: pick("spamShare"),
    repeatAuthorShare: pick("repeatAuthorShare"),
  };
}

/** Rincian komponen skor untuk panel metodologi. */
export function readComponents(metrics: unknown) {
  if (!metrics || typeof metrics !== "object") return null;
  const c = (metrics as { components?: unknown }).components;
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;
  const pick = (key: string): number =>
    typeof o[key] === "number" && Number.isFinite(o[key]) ? (o[key] as number) : 0;
  // v2: komponen tanpa data disimpan null — bukan nol, bukan netral.
  const pickNullable = (key: string): number | null =>
    typeof o[key] === "number" && Number.isFinite(o[key]) ? (o[key] as number) : null;
  return {
    engagement: pick("engagement"),
    consistency: pickNullable("consistency"),
    reach: pickNullable("reach"),
    authenticity: pick("authenticity"),
    performancePenalty: pick("performancePenalty"),
  };
}

export function pct(value: number | null, digits = 2): string {
  if (value === null) return "—";
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: digits })}%`;
}

/**
 * Nol yang berarti "tidak terukur" harus dibaca sebagai tanda hubung.
 * Menampilkan "ER 0%" untuk akun yang menyembunyikan jumlah like adalah
 * tuduhan, bukan pengukuran.
 */
export function pctMeasured(
  value: number | null,
  measurable: boolean | null,
  digits = 2,
): string {
  if (measurable === false) return "—";
  return pct(value, digits);
}

export function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: typeof Heart;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  return (
    <div
      className={cn(
        lab.nestedPanel,
        "flex flex-col gap-1",
        tone === "good" && "border-[color-mix(in_srgb,var(--iv-go)_35%,transparent)] bg-[color-mix(in_srgb,var(--iv-go)_6%,transparent)]",
        tone === "warn" && "border-[color-mix(in_srgb,var(--iv-fair)_35%,transparent)] bg-[color-mix(in_srgb,var(--iv-fair)_6%,transparent)]",
        tone === "bad" && "border-[color-mix(in_srgb,var(--iv-fraud)_35%,transparent)] bg-[color-mix(in_srgb,var(--iv-fraud)_6%,transparent)]",
      )}
    >
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        {Icon ? <Icon className="size-3" aria-hidden /> : null}
        {label}
      </p>
      <p className="text-foreground text-xl font-extrabold tabular-nums tracking-tight">
        {value}
      </p>
      {hint ? (
        <p className="text-muted-foreground text-[11px] leading-snug">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * ER pada satu garis bersama acuannya: median tier yang dipakai menilai,
 * median akun sekelas yang pernah kita ukur, dan rentang p10–p90 ER akun ini.
 *
 * Rentang digambar karena satu angka ER dari belasan post menyiratkan
 * ketepatan yang tidak ada — yang layak dipegang adalah pitanya.
 */
export function BenchmarkBar({
  er,
  benchmark,
  interval,
  peerMedian,
  peerCount,
}: {
  er: number;
  benchmark: number;
  interval?: [number, number] | null;
  peerMedian?: number | null;
  peerCount?: number;
}) {
  const showPeer = peerMedian != null && peerMedian > 0 && (peerCount ?? 0) >= 5;
  const max = Math.max(
    benchmark * 2,
    er * 1.15,
    (interval?.[1] ?? 0) * 1.1,
    showPeer ? (peerMedian as number) * 1.3 : 0,
  );
  const at = (v: number) => `${Math.min(Math.max((v / max) * 100, 0), 100)}%`;
  const ratio = er / benchmark;
  const tone = ratio >= 1 ? "var(--iv-go)" : ratio >= 0.6 ? "var(--iv-fair)" : "var(--iv-weak)";

  return (
    <div className="flex flex-col gap-3" style={{ "--iv-tone": tone } as React.CSSProperties}>
      <div
        className="relative h-12 w-full"
        role="img"
        aria-label={`ER ${pct(er)}, median tier ${pct(benchmark)}${interval ? `, rentang ${pct(interval[0])} sampai ${pct(interval[1])}` : ""}`}
      >
        <span className="absolute inset-x-0 top-6 h-1.5 -translate-y-1/2 rounded-full bg-[var(--iv-track)]" aria-hidden />
        {interval ? (
          <span
            className="iv-range-band absolute top-6 h-3.5 -translate-y-1/2 rounded-full bg-[color-mix(in_srgb,var(--iv-tone)_30%,transparent)]"
            style={{ left: at(interval[0]), width: `calc(${at(interval[1])} - ${at(interval[0])})` }}
            aria-hidden
          />
        ) : null}
        <span
          className="bg-foreground/70 absolute top-6 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2"
          style={{ left: at(benchmark) }}
          aria-hidden
        />
        <span
          className="text-muted-foreground absolute top-0 -translate-x-1/2 text-[10px] whitespace-nowrap"
          style={{ left: at(benchmark) }}
          aria-hidden
        >
          median tier
        </span>
        {showPeer ? (
          <>
            <span
              className="border-foreground/60 absolute top-6 h-5 w-0 -translate-x-1/2 -translate-y-1/2 border-l border-dashed"
              style={{ left: at(peerMedian as number) }}
              aria-hidden
            />
            <span
              className="text-muted-foreground absolute bottom-0 -translate-x-1/2 text-[10px] whitespace-nowrap"
              style={{ left: at(peerMedian as number) }}
              aria-hidden
            >
              akun sekelas
            </span>
          </>
        ) : null}
        <span
          className="iv-range-dot ring-background absolute top-6 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--iv-tone)] ring-2"
          style={{ left: at(er) }}
          aria-hidden
        />
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        ER <strong className="text-foreground">{pct(er)}</strong>, yaitu{" "}
        <strong className="text-foreground">{ratio.toFixed(1)}×</strong> median
        tier ({pct(benchmark)})
        {interval ? (
          <>
            . Dengan sampel post sebanyak ini, ER sebenarnya kemungkinan besar
            ada di antara {pct(interval[0])} dan {pct(interval[1])}
          </>
        ) : null}
        {showPeer ? (
          <>
            . Garis putus-putus: median {peerCount} akun sekelas yang pernah
            kita ukur ({pct(peerMedian as number)})
          </>
        ) : null}
        .
      </p>
    </div>
  );
}

/**
 * Membandingkan dua permukaan Instagram. Selisih besar di antara keduanya
 * bukan tanda buruk — itu memberi tahu format apa yang harus DIPESAN dari
 * influencer ini. Karena itu keduanya dihitung dengan rumus yang sama persis
 * dan ditampilkan bersebelahan: angka utama diambil dari yang terkuat, dan
 * yang lemah tidak menyeretnya turun.
 */
export function SurfacePanel({ audit }: { audit: AuditView }) {
  const feedEr = readNumber(audit.metrics, "feedEngagementRate");
  const reelsEr = audit.reelsEngagementRate;
  const primary = readString(audit.metrics, "primarySurface");
  const gapPct = readNumber(audit.metrics, "surfaceGapPct");
  const viewReliable = readBoolean(audit.metrics, "viewDataRepresentative");
  const bothMeasured = feedEr !== null && reelsEr !== null;
  // v2: selisih yang masih dalam noise sampel tidak dijadikan instruksi format.
  const blended = readString(audit.metrics, "primaryMode") === "blended";
  const basisNote = (surface: string) =>
    blended ? " · dinilai bersama" : primary === surface ? " · dasar skor" : "";

  const strongerLabel = primary === "reels" ? "Reels" : "feed";
  const weakerLabel = primary === "reels" ? "feed" : "Reels";
  const weakerEr = primary === "reels" ? feedEr : reelsEr;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Post feed"
          value={String(audit.feedPostCount)}
          hint={
            feedEr !== null
              ? `ER ${pct(feedEr)} terhadap follower${basisNote("feed")}`
              : "Tidak ada post feed terukur"
          }
          icon={LayoutGrid}
          tone={!blended && primary === "feed" ? "good" : "neutral"}
        />
        <MetricTile
          label="Reels"
          value={String(audit.reelsPostCount)}
          hint={
            reelsEr !== null
              ? `ER ${pct(reelsEr)} terhadap follower${basisNote("reels")}`
              : "Engagement Reels tidak terukur"
          }
          icon={Clapperboard}
          tone={!blended && primary === "reels" ? "good" : "neutral"}
        />
        <MetricTile
          label="Jangkauan Reels"
          value={pct(audit.viewRate)}
          hint={
            viewReliable === false
              ? "View dibagi follower — hanya sebagian Reels melaporkan view, angka ini tidak dipakai menilai"
              : "View dibagi follower"
          }
          icon={Eye}
          tone={viewReliable === false ? "warn" : "neutral"}
        />
        <MetricTile
          label="ER per view Reels"
          value={pct(audit.viewEngagementRate)}
          hint="Seberapa banyak penonton ikut berinteraksi"
          icon={Eye}
        />
      </div>

      {bothMeasured && !blended && gapPct !== null && gapPct >= 50 ? (
        <p className="text-foreground rounded-xl border border-[color-mix(in_srgb,var(--iv-go)_35%,transparent)] bg-[color-mix(in_srgb,var(--iv-go)_7%,transparent)] p-3.5 text-xs leading-relaxed">
          <strong>
            Pesan {strongerLabel}, jangan {weakerLabel}.
          </strong>{" "}
          ER di {strongerLabel} {gapPct.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
          % lebih tinggi daripada di {weakerLabel} ({pct(weakerEr)}). Skor di
          halaman ini memakai angka {strongerLabel} — dengan harga yang sama,
          salah memesan format berarti hasilnya jauh di bawah itu.
        </p>
      ) : null}
      {bothMeasured && blended ? (
        <p className="text-muted-foreground rounded-xl border border-border/70 bg-muted/30 p-3.5 text-xs leading-relaxed">
          {strongerLabel === "Reels" ? "Reels" : "Feed"} sedikit lebih tinggi, tapi
          selisihnya masih dalam batas kebetulan untuk jumlah post sebanyak ini —
          jadi keduanya dinilai bersama dan pemilihan format bisa mengikuti
          kebutuhan kreatif, bukan angka.
        </p>
      ) : null}
      {bothMeasured && !blended && (gapPct === null || gapPct < 50) ? (
        <p className="text-muted-foreground rounded-xl border border-border/70 bg-muted/30 p-3.5 text-xs leading-relaxed">
          Feed dan Reels menghasilkan engagement yang setara, jadi pemilihan
          format bisa mengikuti kebutuhan kreatif — bukan angka.
        </p>
      ) : null}

      <p className="text-muted-foreground text-xs leading-relaxed">
        Kedua permukaan dihitung terpisah dengan rumus yang sama (median like +
        komentar ÷ follower), jadi angkanya benar-benar sebanding. Skor memakai
        permukaan terkuat hanya bila keunggulannya melewati batas kebetulan
        sampel; kalau tidak, keduanya dinilai bersama. Memilih angka tertinggi
        dari dua taksiran yang sama-sama goyah selalu melebihkan hasil. Jangkauan tetap
        hanya dari Reels: hitungan view di grid profil tidak dapat dipercaya,
        jadi Reels diambil lewat panggilan terpisah.
      </p>
    </div>
  );
}

const RISK_TONE: Record<string, string> = {
  high: "border-rose-300/60 bg-rose-50/60 dark:border-rose-500/25 dark:bg-rose-500/10",
  medium:
    "border-amber-300/60 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-500/10",
  low: "border-border/70 bg-muted/30",
};

/**
 * Konten berisiko yang akan berdiri di samping merek.
 *
 * Ditempatkan sebagai panel sendiri, bukan sekadar poin di daftar sinyal,
 * karena satu post judi online lebih menentukan keputusan rekrutmen daripada
 * selisih ER satu-dua persen.
 */
export function BrandSafetyPanel({ hits }: { hits: BrandSafetyHitView[] }) {
  if (hits.length === 0) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-300/50 bg-emerald-50/60 p-4 dark:border-emerald-500/25 dark:bg-emerald-500/10">
        <ShieldCheck
          className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
          aria-hidden
        />
        <div>
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            Tidak ada istilah berisiko di caption yang terbaca
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-emerald-800/80 dark:text-emerald-200/70">
            Pemindaian mencakup judi online, pinjol, investasi bodong, klaim
            kesehatan berlebihan, konten dewasa, alkohol/vape, dan kampanye
            politik. Hanya caption yang dipindai — konten di dalam video atau
            gambar tidak terbaca.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {hits.map((hit) => (
          <li
            key={hit.category}
            className={cn("rounded-xl border p-3.5", RISK_TONE[hit.severity])}
          >
            <div className="flex items-start gap-2.5">
              <ShieldAlert
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  hit.severity === "high"
                    ? "text-rose-600 dark:text-rose-400"
                    : hit.severity === "medium"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground",
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-sm font-semibold">
                  {hit.label}
                  <span className="text-muted-foreground ml-2 text-xs font-medium">
                    {hit.postCount} post
                    {hit.daysSinceLatest !== null
                      ? ` · terbaru ${hit.daysSinceLatest} hari lalu`
                      : ""}
                  </span>
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                  {hit.why}
                </p>
                <p className="text-muted-foreground mt-1.5 text-[11px] leading-relaxed">
                  Cocok pada:{" "}
                  {hit.terms.slice(0, 6).map((t) => (
                    <code
                      key={t}
                      className="bg-muted mr-1 rounded px-1 py-0.5 text-[10px]"
                    >
                      {t}
                    </code>
                  ))}
                </p>
                {hit.sampleUrls.length > 0 ? (
                  <p className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                    {hit.sampleUrls.map((url, i) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-foreground inline-flex items-center gap-1 font-semibold underline underline-offset-2"
                      >
                        Periksa post {i + 1}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ))}
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Ini <strong>pencocokan kata pada caption</strong>, bukan pemahaman
        konteks — post yang membahas bahaya judi online akan ikut tertangkap.
        Buka post-nya sebelum menyimpulkan. Sebaliknya, konten berisiko yang
        hanya muncul di dalam video atau gambar tidak akan terdeteksi sama
        sekali, jadi temuan kosong bukan jaminan bersih.
      </p>
    </div>
  );
}

/**
 * Kualitas komentar: 500 komentar "🔥" tidak sama nilainya dengan 500 komentar
 * yang menanyakan harga produk, meski rasio komentar-terhadap-like identik.
 */
export function CommentQualityPanel({ quality }: { quality: CommentQualityView }) {
  const share = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Tanpa substansi"
          value={share(quality.lowSubstanceShare)}
          hint="Emoji saja atau pujian satu kata"
          icon={MessageCircle}
          tone={
            quality.lowSubstanceShare >= 0.85
              ? "bad"
              : quality.lowSubstanceShare >= 0.7
                ? "warn"
                : "good"
          }
        />
        <MetricTile
          label="Berpola jualan"
          value={share(quality.spamShare)}
          hint="Ajakan cek bio, nomor WA, promosi lain"
          tone={quality.spamShare >= 0.3 ? "bad" : "neutral"}
        />
        <MetricTile
          label="Akun berulang"
          value={share(quality.repeatAuthorShare)}
          hint="Komentar dari akun yang sama di banyak post"
          tone={quality.repeatAuthorShare >= 0.5 ? "warn" : "neutral"}
        />
        <MetricTile
          label="Aksara non-Latin"
          value={share(quality.foreignScriptShare)}
          hint="Indikasi comment farm luar negeri"
          tone={quality.foreignScriptShare >= 0.3 ? "warn" : "neutral"}
        />
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Dihitung dari {quality.analyzedComments} komentar di{" "}
        {quality.postsWithComments} post yang ikut terbawa dataset — bukan
        seluruh komentar. Komentar pendek adalah kebiasaan wajar audiens
        Indonesia, jadi angka tinggi di sini <strong>bukan bukti bot</strong>;
        ia hanya berarti kolom komentarnya tidak menunjukkan minat pada produk.
      </p>
    </div>
  );
}

export function SponsoredPanel({ audit }: { audit: AuditView }) {
  const comparable = audit.sponsoredEr !== null && audit.organicEr !== null;
  const delta = audit.sponsoredDeltaPct;
  const allSurfaces = readNumber(audit.metrics, "sponsoredCountAllSurfaces");
  const share = readNumber(audit.metrics, "sponsoredShare");
  const primary = readString(audit.metrics, "primarySurface");
  const surfaceWord =
    readString(audit.metrics, "primaryMode") === "blended"
      ? "feed dan Reels sekaligus"
      : primary === "reels"
        ? "Reels"
        : "post feed";

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile
          label="Post berbayar"
          value={String(audit.sponsoredCount)}
          hint={audit.sponsoredEr !== null ? `ER ${pct(audit.sponsoredEr)}` : "Sampel belum cukup"}
          icon={Megaphone}
        />
        <MetricTile
          label="Post organik"
          value={String(audit.organicCount)}
          hint={audit.organicEr !== null ? `ER ${pct(audit.organicEr)}` : "Sampel belum cukup"}
        />
        <MetricTile
          label="Selisih"
          value={delta !== null ? `${delta > 0 ? "+" : ""}${delta.toFixed(0)}%` : "—"}
          hint={
            delta !== null
              ? delta < 0
                ? "Engagement turun saat post berbayar"
                : "Post berbayar justru lebih tinggi"
              : "Butuh minimal 2 post di tiap sisi"
          }
          tone={delta === null ? "neutral" : delta < -35 ? "bad" : delta < -20 ? "warn" : "good"}
        />
      </div>

      {!comparable ? (
        <p className="text-muted-foreground rounded-xl border border-border/70 bg-muted/30 p-3.5 text-xs leading-relaxed">
          Belum cukup post di salah satu sisi untuk dibandingkan, jadi perkiraan
          hasil campaign masih memakai ER umum.
        </p>
      ) : null}

      {allSurfaces !== null && share !== null ? (
        <p
          className={cn(
            "rounded-xl border p-3.5 text-xs leading-relaxed",
            share >= 0.5
              ? "border-amber-300/60 bg-amber-50/60 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200"
              : "text-muted-foreground border-border/70 bg-muted/30",
          )}
        >
          Di seluruh permukaan, <strong>{allSurfaces} dari {audit.postsAnalyzed} post</strong>{" "}
          ({Math.round(share * 100)}%) terdeteksi berbayar.
          {share >= 0.5
            ? " Feed yang isinya sebagian besar endorse membuat audiens terbiasa melewatinya — post Anda ikut tenggelam."
            : ""}
        </p>
      ) : null}

      <p className="text-muted-foreground text-xs leading-relaxed">
        Perbandingan di atas dihitung <strong>di dalam {surfaceWord}</strong>{" "}
        saja, supaya post berbayar tidak diadu melawan post organik dari format
        yang berbeda. Deteksi berbayar membaca label paid partnership dan
        hashtag seperti #ad, #endorse, #kerjasama.{" "}
        <strong>Angka ini batas bawah</strong> — influencer yang tidak
        mencantumkan penanda akan terhitung organik, sehingga penurunan
        sesungguhnya bisa lebih besar. Perkiraan ER campaign memakai ER post
        berbayar yang ditarik ke ER umum sebanding sedikitnya post berbayar:
        dua-tiga post endorse terlalu rapuh untuk dipakai apa adanya.
      </p>
    </div>
  );
}

export function PostTable({ posts }: { posts: PostView[] }) {
  const [sort, setSort] = useState<"recent" | "er">("recent");
  if (posts.length === 0) return null;

  // Post yang interaksinya jauh di atas nilai tengah sampel ditandai: dialah
  // yang membuat rata-rata menyesatkan, dan median sengaja mengabaikannya.
  const sampleErs = posts
    .filter((p) => p.inSample && p.likes >= 0)
    .map((p) => p.engagementRate)
    .sort((a, b) => a - b);
  const medianEr =
    sampleErs.length > 0 ? sampleErs[Math.floor(sampleErs.length / 2)] : 0;
  const isOutlier = (p: PostView) =>
    p.likes >= 0 && medianEr > 0 && p.engagementRate > medianEr * 3;

  const rows =
    sort === "er"
      ? [...posts].sort((a, b) => b.engagementRate - a.engagementRate)
      : posts;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Post pudar berada di luar sampel penilaian. Median ER post dalam sampel:{" "}
          <strong className="text-foreground">{pct(medianEr)}</strong>.
        </p>
        <div className="bg-muted inline-flex rounded-lg p-0.5 text-xs" role="group" aria-label="Urutkan post">
          {([["recent", "Terbaru"], ["er", "ER tertinggi"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={sort === key}
              onClick={() => setSort(key)}
              className="text-muted-foreground aria-pressed:bg-background aria-pressed:text-foreground focus-visible:ring-ring/50 rounded-md px-2.5 py-1 font-medium outline-none focus-visible:ring-2 aria-pressed:shadow-sm"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="border-border/60 overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40">
            <tr className="text-muted-foreground text-xs font-medium">
              <th className="px-3 py-2.5 text-left">Post</th>
              <th className="px-3 py-2.5 text-right">Like</th>
              <th className="px-3 py-2.5 text-right">Komentar</th>
              <th className="px-3 py-2.5 text-right">Share</th>
              <th className="px-3 py-2.5 text-right">View</th>
              <th className="px-3 py-2.5 text-right">ER</th>
              <th className="px-3 py-2.5 text-right">Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className={cn(
                  "border-border/50 border-t hover:bg-muted/20",
                  // Post di luar sampel ditampilkan pudar: ada di daftar, tapi
                  // tidak ikut menghitung ER.
                  !p.inSample && "opacity-50",
                )}
              >
                <td className="max-w-[240px] px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <PostThumbnail src={p.thumbnailUrl} className="size-9" />
                    <div className="min-w-0">
                      <div className="mb-0.5 flex flex-wrap gap-1">
                        {p.surface === "reels" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                            <Clapperboard className="size-2.5" aria-hidden />
                            Reels
                          </span>
                        ) : (
                          <span className="bg-muted/70 text-muted-foreground inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                            <LayoutGrid className="size-2.5" aria-hidden />
                            Feed
                          </span>
                        )}
                        {isOutlier(p) ? (
                          <span className="rounded-full bg-[color-mix(in_srgb,var(--iv-fair)_16%,transparent)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--iv-fair)]">
                            Melonjak
                          </span>
                        ) : null}
                        {p.isPinned ? (
                          <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                            Dipin
                          </span>
                        ) : null}
                        {p.isSponsored ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                            <Megaphone className="size-2.5" aria-hidden />
                            Berbayar
                          </span>
                        ) : null}
                        {!p.inSample ? (
                          <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                            Di luar sampel
                          </span>
                        ) : null}
                      </div>
                      {p.url ? (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-muted-foreground hover:text-foreground line-clamp-2 text-xs leading-snug"
                        >
                          {p.caption?.slice(0, 90) || "(tanpa caption)"}
                        </a>
                      ) : (
                        <span className="text-muted-foreground line-clamp-2 text-xs leading-snug">
                          {p.caption?.slice(0, 90) || "(tanpa caption)"}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {/* -1 = pemilik akun menyembunyikan jumlah like. Bukan nol. */}
                  {p.likes < 0 ? (
                    <span
                      className="text-muted-foreground text-xs"
                      title="Pemilik akun menyembunyikan jumlah like — post ini tidak ikut menghitung ER"
                    >
                      disembunyikan
                    </span>
                  ) : (
                    compactNumber(p.likes)
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {compactNumber(p.comments)}
                </td>
                <td className="text-muted-foreground px-3 py-2.5 text-right tabular-nums">
                  {p.shares > 0 ? compactNumber(p.shares) : "—"}
                </td>
                <td className="text-muted-foreground px-3 py-2.5 text-right tabular-nums">
                  {p.views > 0 ? compactNumber(p.views) : "—"}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                  {p.likes < 0 ? "—" : pct(p.engagementRate)}
                </td>
                <td className="text-muted-foreground px-3 py-2.5 text-right text-xs tabular-nums">
                  {p.postedAt
                    ? new Date(p.postedAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "2-digit",
                      })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function NotesEditor({
  profileId,
  initial,
}: {
  profileId: string;
  initial: string | null;
}) {
  const [notes, setNotes] = useState(initial ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        await updateInfluencerNotes({ profileId, notes });
        toast.success("Catatan disimpan.");
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan catatan."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="Rate card, PIC, hasil negosiasi, catatan kampanye sebelumnya…"
      />
      <Button
        size="sm"
        variant="outline"
        onClick={save}
        disabled={pending || notes === (initial ?? "")}
        className="w-fit gap-1.5"
      >
        {pending ? (
          <RefreshCw className="size-3.5 animate-spin" />
        ) : (
          <Save className="size-3.5" />
        )}
        Simpan catatan
      </Button>
    </div>
  );
}
