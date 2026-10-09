"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Info,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react";
import {
  InfluencerAuditStatus,
  InfluencerPlatform,
  InfluencerTier,
  InfluencerVerdict,
} from "@prisma/client";
import { influencerImageSrc } from "@/lib/brand-research/influencer/image-proxy";
import { cn } from "@/lib/utils";
import "./influencer-audit.css";

/**
 * Foto profil influencer.
 *
 * Gambar dilewatkan proxy internal karena CDN Instagram menolak permintaan
 * langsung dari browser. URL CDN juga bertanda tangan dan kedaluwarsa dalam
 * hitungan hari, jadi audit lama pasti akan gagal memuat — karena itu selalu
 * ada fallback inisial, bukan gambar rusak.
 */
export function InfluencerAvatar({
  src,
  handle,
  className,
}: {
  src: string | null;
  handle: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const proxied = influencerImageSrc(src);

  if (!proxied || failed) {
    return (
      <span
        className={cn(
          "bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded-full font-bold",
          className,
        )}
      >
        {handle.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={proxied}
      alt={`Foto profil @${handle}`}
      className={cn("shrink-0 rounded-full object-cover", className)}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/** Thumbnail post, dengan perlakuan sama seperti foto profil. */
export function PostThumbnail({
  src,
  className,
}: {
  src: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const proxied = influencerImageSrc(src);

  if (!proxied || failed) {
    return <span className={cn("bg-muted shrink-0 rounded-md", className)} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={proxied}
      alt=""
      className={cn("shrink-0 rounded-md object-cover", className)}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export const VERDICT_LABEL: Record<InfluencerVerdict, string> = {
  EXCELLENT: "Sangat bagus",
  GOOD: "Bagus",
  AVERAGE: "Rata-rata",
  POOR: "Lemah",
  NEEDS_REVIEW: "Perlu dicek",
  SUSPICIOUS: "Mencurigakan",
};

export const VERDICT_HINT: Record<InfluencerVerdict, string> = {
  EXCELLENT: "Engagement kuat, tidak ada sinyal mencurigakan.",
  GOOD: "Engagement layak, tidak ada sinyal mencurigakan.",
  AVERAGE: "Engagement biasa saja untuk tier follower-nya.",
  POOR: "Engagement di bawah median tier follower-nya.",
  NEEDS_REVIEW:
    "Ada satu sinyal keaslian yang berat. Satu sinyal saja belum cukup jadi kesimpulan — periksa detailnya sebelum memutuskan.",
  SUSPICIOUS:
    "Beberapa sinyal keaslian saling menguatkan. Engagement patut dicurigai dibeli.",
};

export const TIER_LABEL: Record<InfluencerTier, string> = {
  NANO: "Nano",
  MICRO: "Micro",
  MID: "Mid",
  MACRO: "Macro",
  MEGA: "Mega",
};

/**
 * Tier lengkap dengan rentang followernya — untuk dropdown filter, tempat orang
 * perlu tahu batas angkanya sebelum memilih. Di kartu, pakai `TIER_LABEL` yang
 * pendek: di sana angkanya sudah terpampang di sebelahnya.
 */
export const TIER_RANGE_LABEL: Record<InfluencerTier, string> = {
  NANO: "Nano (<10rb)",
  MICRO: "Micro (10rb–100rb)",
  MID: "Mid (100rb–500rb)",
  MACRO: "Macro (500rb–1jt)",
  MEGA: "Mega (>1jt)",
};

export const AUDIT_STATUS_LABEL: Record<InfluencerAuditStatus, string> = {
  PENDING: "Menunggu",
  COLLECTING: "Mengambil data",
  ANALYZING: "Menganalisis",
  READY: "Siap",
  FAILED: "Gagal",
};

export const PLATFORM_LABEL: Record<InfluencerPlatform, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
};

export function isAuditInProgress(
  status: InfluencerAuditStatus | null | undefined,
): boolean {
  return (
    status === InfluencerAuditStatus.PENDING ||
    status === InfluencerAuditStatus.COLLECTING ||
    status === InfluencerAuditStatus.ANALYZING
  );
}

/** Format angka besar jadi ringkas (12,3rb / 1,2jt). */
export function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}rb`;
  }
  return Math.round(value).toLocaleString("id-ID");
}

/** Warna skala vonis (token CSS di influencer-audit.css). */
export function verdictTone(verdict: InfluencerVerdict | null): string {
  switch (verdict) {
    case InfluencerVerdict.EXCELLENT:
    case InfluencerVerdict.GOOD:
      return "var(--iv-go)";
    case InfluencerVerdict.AVERAGE:
      return "var(--iv-fair)";
    case InfluencerVerdict.NEEDS_REVIEW:
      return "var(--iv-review)";
    case InfluencerVerdict.SUSPICIOUS:
      return "var(--iv-fraud)";
    default:
      return "var(--iv-weak)";
  }
}

/** Batas skor antar vonis — digambar sebagai garis halus di batang skor. */
const VERDICT_THRESHOLDS = [45, 65, 80];

/**
 * Batang skor 0–100 dengan rentang ketidakpastian.
 *
 * Titik = skor; pita = rentang p10–p90 hasil mengacak ulang sampel post.
 * Pita lebar berarti angkanya belum boleh dipegang — dua influencer dengan
 * skor sama bisa berbeda jauh keandalannya, dan inilah yang membuatnya
 * terlihat sekilas. Audit metode lama tidak punya rentang: hanya titiknya.
 */
export function ScoreRangeBar({
  score,
  interval,
  verdict,
  size = "sm",
  className,
}: {
  score: number;
  interval: [number, number] | null;
  verdict: InfluencerVerdict | null;
  size?: "sm" | "lg";
  className?: string;
}) {
  const clampPct = (v: number) => Math.max(0, Math.min(100, v));
  const lo = interval ? clampPct(Math.min(interval[0], score)) : null;
  const hi = interval ? clampPct(Math.max(interval[1], score)) : null;
  const lg = size === "lg";

  return (
    <div
      role="img"
      aria-label={
        interval
          ? `Skor ${score} dari 100, rentang ${interval[0]} sampai ${interval[1]}`
          : `Skor ${score} dari 100`
      }
      className={cn("relative w-full", lg ? "h-4" : "h-3", className)}
      style={{ "--iv-tone": verdictTone(verdict) } as React.CSSProperties}
    >
      <span
        className={cn(
          "absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full bg-[var(--iv-track)]",
          lg ? "h-1.5" : "h-1",
        )}
        aria-hidden
      />
      {VERDICT_THRESHOLDS.map((t) => (
        <span
          key={t}
          className={cn(
            "bg-background absolute top-1/2 w-px -translate-y-1/2",
            lg ? "h-1.5" : "h-1",
          )}
          style={{ left: `${t}%` }}
          aria-hidden
        />
      ))}
      {lo !== null && hi !== null ? (
        <span
          className={cn(
            "iv-range-band absolute top-1/2 -translate-y-1/2 rounded-full bg-[color-mix(in_srgb,var(--iv-tone)_32%,transparent)]",
            lg ? "h-3" : "h-2",
          )}
          style={{ left: `${lo}%`, width: `${Math.max(hi - lo, 1.5)}%` }}
          aria-hidden
        />
      ) : null}
      <span
        className={cn(
          "iv-range-dot ring-background absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--iv-tone)] ring-2",
          lg ? "size-3.5" : "size-2.5",
        )}
        style={{ left: `${clampPct(score)}%` }}
        aria-hidden
      />
    </div>
  );
}

/**
 * Keandalan 0–100 sebagai lima ruas: penuh = angka layak dipegang.
 * Null = audit metode lama, yang belum menghitungnya.
 */
export function ReliabilityMeter({
  value,
  showLabel = true,
  className,
}: {
  value: number | null;
  showLabel?: boolean;
  className?: string;
}) {
  if (value === null) {
    return (
      <span className={cn("text-muted-foreground text-xs", className)}>—</span>
    );
  }
  const filled = Math.round(value / 20);
  const tone =
    value >= 75 ? "var(--foreground)" : value >= 45 ? "var(--iv-fair)" : "var(--iv-weak)";

  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      title="Keandalan data: jumlah post terukur, like yang terlihat, data view, kesegaran sampel, contoh komentar, dan konsistensi dengan audit sebelumnya. Bukan kualitas influencer-nya."
      style={{ "--iv-tone": tone } as React.CSSProperties}
    >
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-2.5 w-1.5 rounded-[2px]",
              i < filled ? "bg-[var(--iv-tone)]" : "bg-[var(--iv-track)]",
            )}
          />
        ))}
      </span>
      {showLabel ? (
        <span className="text-foreground text-xs font-semibold tabular-nums">
          {value}
          <span className="sr-only"> dari 100</span>
        </span>
      ) : (
        <span className="sr-only">Keandalan {value} dari 100</span>
      )}
    </span>
  );
}

/** Penanda audit yang dihitung sebelum metode v2. */
export function LegacyMethodBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "border-border text-muted-foreground inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[11px] font-medium",
        className,
      )}
      title="Audit ini dihitung sebelum ada rentang ketidakpastian, keandalan, dan kalibrasi populasi. Jalankan audit ulang untuk skor dengan metode terbaru."
    >
      Metode lama
    </span>
  );
}

export function VerdictBadge({
  verdict,
  className,
}: {
  verdict: InfluencerVerdict | null;
  className?: string;
}) {
  if (!verdict) {
    return (
      <span
        className={cn(
          "bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
          className,
        )}
      >
        Belum diaudit
      </span>
    );
  }

  const Icon =
    verdict === InfluencerVerdict.SUSPICIOUS
      ? ShieldAlert
      : verdict === InfluencerVerdict.NEEDS_REVIEW
        ? ShieldQuestion
        : verdict === InfluencerVerdict.EXCELLENT || verdict === InfluencerVerdict.GOOD
          ? ShieldCheck
          : Info;

  return (
    <span
      className={cn(
        "iv-tint inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        // "Sangat bagus" diberi garis tepi supaya terbedakan dari "Bagus"
        // tanpa menambah warna kelima di skala yang sama.
        verdict === InfluencerVerdict.EXCELLENT &&
          "ring-1 ring-[color-mix(in_srgb,var(--iv-tone)_45%,transparent)] ring-inset",
        className,
      )}
      style={{ "--iv-tone": verdictTone(verdict) } as React.CSSProperties}
      title={VERDICT_HINT[verdict]}
    >
      <Icon className="size-3.5" aria-hidden />
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

export function AuditStatusPill({
  status,
}: {
  status: InfluencerAuditStatus | null;
}) {
  const running = isAuditInProgress(status);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        status === InfluencerAuditStatus.READY &&
          "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        status === InfluencerAuditStatus.FAILED &&
          "bg-rose-500/15 text-rose-700 dark:text-rose-300",
        running && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        status == null && "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === InfluencerAuditStatus.READY && "bg-emerald-500",
          status === InfluencerAuditStatus.FAILED && "bg-rose-500",
          running && "bg-amber-500 animate-pulse motion-reduce:animate-none",
          status == null && "bg-muted-foreground/50",
        )}
        aria-hidden
      />
      {status ? AUDIT_STATUS_LABEL[status] : "Belum diaudit"}
    </span>
  );
}

/**
 * Cincin skor. Warna mengikuti vonis, bukan angka, supaya skor tinggi yang
 * ditandai mencurigakan tidak tampil hijau.
 */
export function ScoreRing({
  score,
  verdict,
  size = 72,
}: {
  score: number;
  verdict: InfluencerVerdict | null;
  size?: number;
}) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score)) / 100;

  const color = verdictTone(verdict);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Skor ${score} dari 100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-foreground text-lg font-extrabold tabular-nums leading-none">
          {score}
        </span>
        <span className="text-muted-foreground text-[9px] font-medium">/100</span>
      </span>
    </div>
  );
}

export type FlagImpact =
  | "authenticity"
  | "performance"
  | "data"
  | "brandSafety";

export type FakeFlag = {
  code: string;
  severity: "high" | "medium" | "low";
  impact: FlagImpact;
  label: string;
  detail: string;
  penalty: number;
};

/** Baca `fakeFlags` Json dari DB dengan aman. */
export function parseFakeFlags(raw: unknown): FakeFlag[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f): f is FakeFlag =>
      !!f &&
      typeof f === "object" &&
      typeof (f as FakeFlag).code === "string" &&
      typeof (f as FakeFlag).label === "string" &&
      typeof (f as FakeFlag).detail === "string" &&
      ["high", "medium", "low"].includes((f as FakeFlag).severity) &&
      ["authenticity", "performance", "data", "brandSafety"].includes(
        (f as FakeFlag).impact,
      ),
  );
}

export const CONFIDENCE_LABEL: Record<string, string> = {
  high: "Tinggi",
  medium: "Sedang",
  low: "Rendah",
};

export function ConfidenceBadge({ confidence }: { confidence: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        confidence === "high" &&
          "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        confidence === "medium" &&
          "bg-amber-500/15 text-amber-800 dark:text-amber-300",
        confidence === "low" && "bg-muted text-muted-foreground",
      )}
      title="Seberapa dipercaya angkanya — ditentukan jumlah post dan rentang waktunya, bukan kualitas influencer-nya."
    >
      Keyakinan {CONFIDENCE_LABEL[confidence] ?? confidence}
    </span>
  );
}

function FlagItem({ flag }: { flag: FakeFlag }) {
  // Sinyal kualitas data selalu tampil netral: itu keterbatasan pengukuran,
  // bukan tuduhan terhadap influencer-nya.
  const neutral = flag.impact === "data";
  const Icon = neutral ? Info : AlertTriangle;

  return (
    <li
      className={cn(
        "flex items-start gap-2.5 rounded-xl border p-3.5",
        !neutral &&
          flag.severity === "high" &&
          "border-rose-300/60 bg-rose-50/60 dark:border-rose-500/25 dark:bg-rose-500/10",
        !neutral &&
          flag.severity === "medium" &&
          "border-amber-300/60 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-500/10",
        (neutral || flag.severity === "low") && "border-border/70 bg-muted/30",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          neutral
            ? "text-muted-foreground"
            : flag.severity === "high"
              ? "text-rose-600 dark:text-rose-400"
              : flag.severity === "medium"
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground",
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-foreground text-sm font-semibold">{flag.label}</p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
          {flag.detail}
        </p>
      </div>
    </li>
  );
}

const IMPACT_HEADING: Record<FlagImpact, { title: string; note: string }> = {
  brandSafety: {
    title: "Risiko asosiasi merek",
    note: "Tidak memotong skor — skor mengukur performa, ini soal konten yang akan berdiri di samping merek Anda. Wajib diperiksa manual.",
  },
  authenticity: {
    title: "Sinyal keaslian",
    note: "Menurunkan skor keaslian dan bisa membatalkan rekomendasi.",
  },
  performance: {
    title: "Sinyal performa",
    note: "Engagement-nya nyata, tapi hasil yang Anda dapat berpotensi lebih rendah.",
  },
  data: {
    title: "Keterbatasan data",
    note: "Tidak menghukum penilaian — hanya menurunkan tingkat keyakinan.",
  },
};

export function FakeFlagList({ flags }: { flags: FakeFlag[] }) {
  const brandSafety = flags.filter((f) => f.impact === "brandSafety");
  const authenticity = flags.filter((f) => f.impact === "authenticity");
  const performance = flags.filter((f) => f.impact === "performance");
  const data = flags.filter((f) => f.impact === "data");

  // Kabar baik soal keaslian tidak boleh berdiri di atas temuan judi online:
  // pembaca berhenti di banner hijau pertama yang dilihatnya.
  const hasSevereRisk = brandSafety.some((f) => f.severity === "high");

  return (
    <div className="flex flex-col gap-4">
      {authenticity.length === 0 && !hasSevereRisk ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-300/50 bg-emerald-50/60 p-4 dark:border-emerald-500/25 dark:bg-emerald-500/10">
          <BadgeCheck
            className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
          <div>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
              Tidak ada sinyal engagement palsu
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-emerald-800/80 dark:text-emerald-200/70">
              Rasio komentar, sebaran engagement antar post, dan jangkauan
              semuanya berada di rentang wajar.
            </p>
          </div>
        </div>
      ) : null}

      {(
        [
          ["brandSafety", brandSafety],
          ["authenticity", authenticity],
          ["performance", performance],
          ["data", data],
        ] as const
      ).map(([impact, list]) =>
        list.length === 0 ? null : (
          <div key={impact} className="flex flex-col gap-2">
            <div>
              <p className="text-foreground text-sm font-semibold">
                {IMPACT_HEADING[impact].title}
              </p>
              <p className="text-muted-foreground text-[11px] leading-snug">
                {IMPACT_HEADING[impact].note}
              </p>
            </div>
            <ul className="flex flex-col gap-2">
              {list.map((flag) => (
                <FlagItem key={flag.code} flag={flag} />
              ))}
            </ul>
          </div>
        ),
      )}
    </div>
  );
}
