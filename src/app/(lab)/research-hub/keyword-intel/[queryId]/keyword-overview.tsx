import type { KeywordIntelStatus } from "@prisma/client";
import { Loader2 } from "lucide-react";
import type { KeywordSignalStats } from "@/lib/research/keyword-intel/keyword-signal-types";
import { cn } from "@/lib/utils";

/** Section halaman detail: judul rh-section-title + kalimat rh-meta opsional. */
export function DetailSection({
  id,
  title,
  description,
  aside,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  /** Info kecil di kanan judul (mis. jumlah). */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="space-y-0.5">
          <h2 id={id} className="rh-section-title">
            {title}
          </h2>
          {description ? <p className="rh-meta">{description}</p> : null}
        </div>
        {aside ? <p className="rh-meta rh-num">{aside}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Langkah pipeline nyata dari status — tanpa persentase karangan. */
const QUEUED_STEP = { step: 0, label: "Menunggu antrean" };
const STEP_BY_STATUS: Partial<Record<KeywordIntelStatus, { step: number; label: string }>> = {
  PENDING: QUEUED_STEP,
  COLLECTING: { step: 1, label: "Mengumpulkan sinyal marketplace dan volume" },
  ANALYZING: { step: 2, label: "Menganalisis keyword dengan AI" },
};

export function KeywordProgress({ status }: { status: KeywordIntelStatus }) {
  const current = STEP_BY_STATUS[status] ?? QUEUED_STEP;
  return (
    <section
      aria-label="Progres analisis"
      className="border-border flex flex-col gap-2 border-y py-5"
    >
      <p className="text-foreground flex items-center gap-2 text-sm font-medium" aria-live="polite">
        <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
        {current.step > 0 ? `Langkah ${current.step} dari 2: ` : ""}
        {current.label}
      </p>
      <p className="rh-meta">
        Pengumpulan sinyal dan analisis AI berjalan di background. Halaman ini
        diperbarui otomatis setiap beberapa detik.
      </p>
    </section>
  );
}

const SIGNAL_SEGMENTS = [
  { key: "shopee", label: "Shopee", dot: "bg-violet-500" },
  { key: "tokopedia", label: "Tokopedia", dot: "bg-teal-500" },
  { key: "googleTrends", label: "Google Trends", dot: "bg-amber-400" },
  { key: "dataforseo", label: "Google volume", dot: "bg-sky-500" },
  { key: "shopeeSearch", label: "Sampel Shopee", dot: "bg-rose-400" },
  { key: "internal", label: "Sinyal internal", dot: "bg-emerald-500" },
] as const;

type SignalKey = (typeof SIGNAL_SEGMENTS)[number]["key"];

function signalCounts(stats: KeywordSignalStats): Record<SignalKey, number> {
  const internal =
    (stats.internal?.competitor ?? 0) +
    (stats.internal?.reviewIntel ?? 0) +
    (stats.internal?.socialListening ?? 0);
  return {
    shopee: stats.external?.shopee ?? 0,
    tokopedia: stats.external?.tokopedia ?? 0,
    googleTrends: stats.external?.googleTrends ?? 0,
    dataforseo: stats.external?.dataforseo ?? 0,
    shopeeSearch: stats.external?.shopeeSearch ?? 0,
    internal,
  };
}

/**
 * Ringkasan hasil: definition list metrik + distribusi sinyal per sumber.
 * Menggantikan papan tile bento berwarna.
 */
export function KeywordOverview({
  keywordCount,
  highConfidenceCount,
  gapCount,
  namingCount,
  clusterCount,
  hasGoogleVolume,
  signalStats,
}: {
  keywordCount: number;
  highConfidenceCount: number;
  gapCount: number;
  namingCount: number;
  clusterCount: number;
  hasGoogleVolume: boolean;
  signalStats: KeywordSignalStats | null;
}) {
  const facts: { label: string; value: string; hint?: string }[] = [
    {
      label: "Keyword teranalisis",
      value: keywordCount.toLocaleString("id-ID"),
      hint:
        highConfidenceCount > 0
          ? `${highConfidenceCount.toLocaleString("id-ID")} dengan confidence tinggi`
          : undefined,
    },
    { label: "Keyword gap", value: gapCount.toLocaleString("id-ID"), hint: "Peluang belum tergarap" },
    { label: "Saran naming", value: namingCount > 0 ? namingCount.toLocaleString("id-ID") : "—" },
    { label: "Cluster tema", value: clusterCount > 0 ? clusterCount.toLocaleString("id-ID") : "—" },
    {
      label: "Volume Google",
      value: hasGoogleVolume ? "Terukur" : "Estimasi",
      hint: hasGoogleVolume ? "Volume pencarian nyata" : "Proksi dari rank dan listing",
    },
  ];

  const counts = signalStats ? signalCounts(signalStats) : null;
  const present = counts ? SIGNAL_SEGMENTS.filter((s) => counts[s.key] > 0) : [];
  const denom = counts ? Math.max(1, present.reduce((sum, s) => sum + counts[s.key], 0)) : 1;
  const signalTotal = signalStats?.total ?? 0;

  return (
    <section
      aria-label="Ringkasan hasil"
      className="border-border grid gap-6 border-y py-5 lg:grid-cols-[1fr_minmax(16rem,22rem)] lg:gap-10"
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label} className="flex flex-col gap-0.5">
            <dt className="rh-meta">{f.label}</dt>
            <dd className="rh-num text-foreground text-lg font-semibold tracking-tight">{f.value}</dd>
            {f.hint ? <dd className="rh-meta">{f.hint}</dd> : null}
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="rh-meta">Sinyal per sumber</p>
          <p className="rh-meta rh-num">{signalTotal.toLocaleString("id-ID")} sinyal</p>
        </div>
        {counts && present.length > 0 ? (
          <>
            <div
              className="bg-muted flex h-2 overflow-hidden rounded-full"
              role="img"
              aria-label={present.map((s) => `${s.label} ${counts[s.key]}`).join(", ")}
            >
              {present.map((s) => (
                <span
                  key={s.key}
                  className={s.dot}
                  style={{ width: `${(counts[s.key] / denom) * 100}%` }}
                />
              ))}
            </div>
            <ul className="flex flex-col gap-1">
              {present.map((s) => (
                <li key={s.key} className="flex items-center gap-2 text-xs">
                  <span className={cn("size-2 shrink-0 rounded-full", s.dot)} aria-hidden />
                  <span className="text-muted-foreground flex-1">{s.label}</span>
                  <span className="rh-num font-medium">{counts[s.key].toLocaleString("id-ID")}</span>
                  <span className="rh-num text-muted-foreground w-10 text-right">
                    {Math.round((counts[s.key] / denom) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="rh-meta">Statistik sinyal belum tersedia untuk analisis ini.</p>
        )}
      </div>
    </section>
  );
}
