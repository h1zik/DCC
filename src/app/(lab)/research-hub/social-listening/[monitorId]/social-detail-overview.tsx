import { SocialListeningPlatform } from "@prisma/client";
import { SOCIAL_LISTENING_PLATFORM_LABELS } from "@/lib/research/labels";
import { cn } from "@/lib/utils";
import { DetailSection, MetricList } from "./detail-section";

/** Urutan & warna segmen klasifikasi mention (warna kategorikal data). */
const CLASS_SEGMENTS = [
  { key: "PRAISE", label: "Pujian", dot: "bg-emerald-500" },
  { key: "RECOMMENDATION", label: "Rekomendasi", dot: "bg-teal-500" },
  { key: "COMPLAINT", label: "Keluhan", dot: "bg-rose-500" },
  { key: "QUESTION", label: "Pertanyaan", dot: "bg-sky-500" },
  { key: "WISHLIST", label: "Wishlist", dot: "bg-violet-500" },
  { key: "NEUTRAL", label: "Netral", dot: "bg-slate-400 dark:bg-slate-500" },
] as const;

/** Ringkasan angka batch: metrik `dl` + distribusi klasifikasi mention. */
export function SocialDetailOverview({
  totalMentions,
  mentionCounts,
  commentCount,
  viralCount,
  influencerCount,
  categoryBreakdown,
}: {
  totalMentions: number;
  mentionCounts: { platform: SocialListeningPlatform; count: number }[];
  commentCount: number;
  viralCount: number;
  influencerCount: number;
  categoryBreakdown: { classification: string; count: number; pct: number }[];
}) {
  const classTotal = Math.max(
    categoryBreakdown.reduce((sum, c) => sum + c.count, 0),
    1,
  );
  const segments = CLASS_SEGMENTS.flatMap((s) => {
    const row = categoryBreakdown.find((c) => c.classification === s.key);
    return row ? [{ ...s, count: row.count }] : [];
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <MetricList
        items={[
          { label: "Total mention", value: totalMentions.toLocaleString("id-ID") },
          ...mentionCounts.map((m) => ({
            label: SOCIAL_LISTENING_PLATFORM_LABELS[m.platform],
            value: m.count.toLocaleString("id-ID"),
          })),
          { label: "Komentar dianalisis", value: commentCount.toLocaleString("id-ID") },
          { label: "Konten viral", value: viralCount.toLocaleString("id-ID") },
          { label: "Kreator terdeteksi", value: influencerCount.toLocaleString("id-ID") },
        ]}
      />

      <DetailSection
        title="Klasifikasi mention"
        description={
          segments.length === 0
            ? "Klasifikasi muncul setelah analisis AI selesai."
            : `Dari ${totalMentions.toLocaleString("id-ID")} mention di sync terakhir.`
        }
      >
        {segments.length > 0 ? (
          <>
            <div
              className="bg-muted flex h-2.5 overflow-hidden rounded-full"
              role="img"
              aria-label={segments.map((s) => `${s.label} ${s.count}`).join(", ")}
            >
              {segments.map((s) =>
                s.count > 0 ? (
                  <div
                    key={s.key}
                    className={s.dot}
                    style={{ width: `${(s.count / classTotal) * 100}%` }}
                  />
                ) : null,
              )}
            </div>
            <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {segments.map((s) => (
                <li key={s.key} className="flex items-center gap-2 text-sm">
                  <span className={cn("size-2 shrink-0 rounded-full", s.dot)} aria-hidden />
                  <span className="text-muted-foreground flex-1">{s.label}</span>
                  <span className="rh-num font-medium">{s.count.toLocaleString("id-ID")}</span>
                  <span className="rh-meta rh-num w-10 text-right">
                    {Math.round((s.count / classTotal) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </DetailSection>
    </div>
  );
}
