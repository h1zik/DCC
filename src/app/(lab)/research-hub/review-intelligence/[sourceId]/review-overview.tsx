import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Section halaman detail: judul rh-section-title + kalimat rh-meta opsional. */
export function DetailSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="space-y-0.5">
        <h2 id={id} className="rh-section-title">
          {title}
        </h2>
        {description ? <p className="rh-meta">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Peringatan data parsial: marketplace melaporkan lebih banyak review dari yang ter-scrape. */
export function PartialDataNotice({
  reviewCount,
  totalReported,
}: {
  reviewCount: number;
  totalReported: number;
}) {
  const pct = Math.round((reviewCount / totalReported) * 100);
  return (
    <div
      className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-200"
      role="note"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="text-[13px] leading-relaxed">
        <span className="font-semibold">Data parsial.</span> Marketplace
        melaporkan{" "}
        <span className="rh-num font-semibold">{totalReported.toLocaleString("id-ID")}</span>{" "}
        review, tetapi scraper hanya mengambil{" "}
        <span className="rh-num font-semibold">{reviewCount.toLocaleString("id-ID")}</span>{" "}
        ({pct}%). Baca insight sebagai sampel, bukan populasi penuh.
      </p>
    </div>
  );
}

const SENTIMENT_SEGMENTS = [
  { key: "positive", label: "Positif", dot: "bg-emerald-500" },
  { key: "neutral", label: "Netral", dot: "bg-slate-400 dark:bg-slate-500" },
  { key: "negative", label: "Negatif", dot: "bg-rose-500" },
] as const;

/**
 * Ringkasan hasil: satu angka utama (review dianalisis), definition list tema,
 * dan distribusi sentimen. Menggantikan papan tile bento berwarna.
 */
export function ReviewOverview({
  reviewCount,
  totalReported,
  platformLabel,
  sentiment,
  complaintCount,
  topComplaint,
  praiseCount,
  topPraise,
}: {
  reviewCount: number;
  totalReported: number | null;
  platformLabel: string;
  sentiment: { positive: number; neutral: number; negative: number };
  complaintCount: number;
  topComplaint: string | null;
  praiseCount: number;
  topPraise: string | null;
}) {
  const partial = totalReported != null && totalReported > reviewCount;
  const sentimentTotal = Math.max(
    sentiment.positive + sentiment.neutral + sentiment.negative,
    1,
  );
  const present = SENTIMENT_SEGMENTS.filter((s) => sentiment[s.key] > 0);

  return (
    <section
      aria-label="Ringkasan hasil"
      className="border-border grid gap-6 border-y py-5 lg:grid-cols-[minmax(12rem,auto)_1fr_minmax(14rem,20rem)] lg:gap-10"
    >
      <div className="flex flex-col gap-1">
        <p className="rh-meta">Review dianalisis</p>
        <p className="rh-num text-foreground text-[2rem] leading-none font-semibold tracking-tight">
          {reviewCount.toLocaleString("id-ID")}
        </p>
        <p className="rh-meta">
          {partial
            ? `Sampel dari ${totalReported.toLocaleString("id-ID")} review di ${platformLabel}`
            : `Dari ${platformLabel}`}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="rh-meta">Tema keluhan</dt>
          <dd className="rh-num text-foreground text-lg font-semibold tracking-tight">
            {complaintCount.toLocaleString("id-ID")}
          </dd>
          <dd className="rh-meta truncate">
            {topComplaint ? `Teratas: ${topComplaint}` : "Belum ada keluhan terdeteksi"}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="rh-meta">Tema pujian</dt>
          <dd className="rh-num text-foreground text-lg font-semibold tracking-tight">
            {praiseCount.toLocaleString("id-ID")}
          </dd>
          <dd className="rh-meta truncate">
            {topPraise ? `Teratas: ${topPraise}` : "Belum ada pujian terdeteksi"}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2.5">
        <p className="rh-meta">Distribusi sentimen</p>
        <div
          className="bg-muted flex h-2 overflow-hidden rounded-full"
          role="img"
          aria-label={SENTIMENT_SEGMENTS.map(
            (s) => `${s.label} ${sentiment[s.key].toFixed(0)}%`,
          ).join(", ")}
        >
          {present.map((s) => (
            <span
              key={s.key}
              className={s.dot}
              style={{ width: `${(sentiment[s.key] / sentimentTotal) * 100}%` }}
            />
          ))}
        </div>
        <ul className="flex flex-col gap-1">
          {SENTIMENT_SEGMENTS.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-xs">
              <span className={cn("size-2 shrink-0 rounded-full", s.dot)} aria-hidden />
              <span className="text-muted-foreground flex-1">{s.label}</span>
              <span className="rh-num font-medium">{sentiment[s.key].toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
