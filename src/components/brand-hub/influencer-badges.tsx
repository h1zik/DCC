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
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        verdict === InfluencerVerdict.EXCELLENT &&
          "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        verdict === InfluencerVerdict.GOOD &&
          "bg-teal-500/15 text-teal-700 dark:text-teal-300",
        verdict === InfluencerVerdict.AVERAGE &&
          "bg-amber-500/15 text-amber-800 dark:text-amber-300",
        verdict === InfluencerVerdict.POOR &&
          "bg-orange-500/15 text-orange-700 dark:text-orange-300",
        // Ungu, sengaja bukan merah: ini "ditahan untuk diperiksa",
        // bukan tuduhan.
        verdict === InfluencerVerdict.NEEDS_REVIEW &&
          "bg-violet-500/15 text-violet-700 dark:text-violet-300",
        verdict === InfluencerVerdict.SUSPICIOUS &&
          "bg-rose-500/15 text-rose-700 dark:text-rose-300",
        className,
      )}
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

  const color =
    verdict === InfluencerVerdict.SUSPICIOUS
      ? "var(--color-rose-500)"
      : verdict === InfluencerVerdict.NEEDS_REVIEW
        ? "var(--color-violet-500)"
        : verdict === InfluencerVerdict.EXCELLENT
          ? "var(--color-emerald-500)"
          : verdict === InfluencerVerdict.GOOD
            ? "var(--color-teal-500)"
            : verdict === InfluencerVerdict.AVERAGE
              ? "var(--color-amber-500)"
              : "var(--color-orange-500)";

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
              <p className="text-foreground text-xs font-bold uppercase tracking-wide">
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
