"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { InfluencerPlatform } from "@prisma/client";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  LegacyMethodBadge,
  ReliabilityMeter,
  ScoreRangeBar,
  VERDICT_HINT,
  VERDICT_LABEL,
  verdictTone,
} from "@/components/brand-hub/influencer-badges";
import {
  RELIABILITY_FACTOR_LABEL,
  type AuditTrustView,
} from "@/lib/brand-research/influencer/metrics-view";
import { cn } from "@/lib/utils";
import { pct, type Narrative } from "./audit-panels";
import type { AuditView } from "./types";

const REASON_MARK: Record<string, string> = {
  down: "Turun",
  cap: "Dibatasi",
  hold: "Ditahan",
  info: "Catatan",
};

function ReliabilityFactors({ factors }: { factors: Record<string, number> }) {
  const entries = Object.entries(factors);
  return (
    <ul className="flex flex-col gap-1.5">
      {entries.map(([key, value]) => (
        <li key={key} className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground w-44 shrink-0">
            {RELIABILITY_FACTOR_LABEL[key] ?? key}
          </span>
          <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--iv-track)]">
            <span
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                value >= 1 ? "bg-foreground/70" : "bg-[var(--iv-fair)]",
              )}
              style={{ width: `${Math.round(value * 100)}%` }}
            />
          </span>
          <span className="text-foreground w-10 text-right tabular-nums">
            {Math.round(value * 100)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Jawaban atas satu pertanyaan — "pakai orang ini atau tidak, dan kenapa" —
 * sebelum bukti apa pun. Bukti tetap ada di tab di bawahnya untuk yang ingin
 * memeriksa.
 */
export function DecisionBlock({
  audit,
  trust,
  narrative,
}: {
  audit: AuditView;
  trust: AuditTrustView;
  narrative: Narrative | null;
}) {
  const [factorsOpen, setFactorsOpen] = useState(false);
  const verdict = audit.verdict;
  const legacy = trust.scoringVersion < 2;
  const reasons = trust.verdictReasons.filter((r) => r.effect !== "info");
  const notes = trust.verdictReasons.filter((r) => r.effect === "info");

  return (
    <section
      aria-labelledby="decision-heading"
      className="border-border bg-card/70 overflow-hidden rounded-2xl border"
      style={{ "--iv-tone": verdictTone(verdict) } as React.CSSProperties}
    >
      <div className="h-1 bg-[var(--iv-tone)]" aria-hidden />
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">Vonis audit</p>
          <h2
            id="decision-heading"
            className="mt-1 text-4xl leading-none font-bold tracking-tight text-[var(--iv-tone)] sm:text-5xl"
          >
            {verdict ? VERDICT_LABEL[verdict] : "Belum ada vonis"}
          </h2>
          {verdict ? (
            <p className="text-muted-foreground mt-2 max-w-prose text-sm leading-relaxed">
              {VERDICT_HINT[verdict]}
            </p>
          ) : null}

          {reasons.length > 0 ? (
            <div className="mt-5">
              <h3 className="text-foreground text-sm font-semibold">
                Kenapa vonisnya ini
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {reasons.slice(0, 4).map((r) => (
                  <li key={r.code} className="flex gap-2.5 text-sm leading-relaxed">
                    <span className="text-foreground bg-muted mt-0.5 h-fit shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium">
                      {REASON_MARK[r.effect]}
                    </span>
                    <span className="text-muted-foreground">{r.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {narrative?.recommendation || audit.aiSummary ? (
            <div className="border-border/60 mt-5 border-t pt-4">
              <h3 className="text-foreground text-sm font-semibold">Rekomendasi</h3>
              <p className="text-foreground mt-1.5 max-w-prose text-sm leading-relaxed">
                {narrative?.recommendation ?? audit.aiSummary}
              </p>
              {narrative?.recommendation && audit.aiSummary ? (
                <p className="text-muted-foreground mt-2 max-w-prose text-sm leading-relaxed">
                  {audit.aiSummary}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-5 lg:border-l lg:border-border/60 lg:pl-6">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-muted-foreground text-sm">Skor</p>
              {legacy ? <LegacyMethodBadge /> : null}
            </div>
            <p className="text-foreground mt-1 flex items-baseline gap-2">
              <span className="text-5xl leading-none font-bold tracking-tight tabular-nums">
                {audit.score}
              </span>
              <span className="text-muted-foreground text-sm tabular-nums">
                {trust.scoreInterval
                  ? `kemungkinan ${trust.scoreInterval[0]}–${trust.scoreInterval[1]}`
                  : "/100"}
              </span>
            </p>
            <ScoreRangeBar
              score={audit.score}
              interval={trust.scoreInterval}
              verdict={verdict}
              size="lg"
              className="mt-3"
            />
            <div className="text-muted-foreground mt-1 flex justify-between text-[10px] tabular-nums" aria-hidden>
              <span>0</span>
              <span>100</span>
            </div>
          </div>

          <div>
            <p className="text-muted-foreground text-sm">Keandalan data</p>
            {trust.reliability !== null ? (
              <Collapsible open={factorsOpen} onOpenChange={setFactorsOpen}>
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <ReliabilityMeter value={trust.reliability} />
                  {trust.reliabilityFactors ? (
                    <CollapsibleTrigger className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded-md text-xs outline-none focus-visible:ring-2">
                      Rinciannya
                      <ChevronDown
                        className={cn("size-3.5 transition-transform motion-reduce:transition-none", factorsOpen && "rotate-180")}
                        aria-hidden
                      />
                    </CollapsibleTrigger>
                  ) : null}
                </div>
                {trust.reliabilityFactors ? (
                  <CollapsiblePanel>
                    <div className="mt-3">
                      <ReliabilityFactors factors={trust.reliabilityFactors} />
                    </div>
                  </CollapsiblePanel>
                ) : null}
                <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                  Seberapa jauh angka di halaman ini boleh dipegang — bukan
                  kualitas influencer-nya.
                </p>
              </Collapsible>
            ) : (
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Belum dihitung untuk audit ini. Jalankan audit ulang untuk
                melihat rentang skor dan keandalannya.
              </p>
            )}
          </div>

          {notes.length > 0 ? (
            <ul className="text-muted-foreground flex flex-col gap-1.5 text-xs leading-relaxed">
              {notes.map((n) => (
                <li key={n.code}>{n.text}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {narrative?.strengths?.length || narrative?.risks?.length ? (
        <div className="border-border/60 grid gap-5 border-t p-5 sm:grid-cols-2 sm:p-6">
          {narrative?.strengths?.length ? (
            <div>
              <h3 className="text-foreground text-sm font-semibold">Kekuatan</h3>
              <ul className="text-muted-foreground mt-2 flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed">
                {narrative.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {narrative?.risks?.length ? (
            <div>
              <h3 className="text-foreground text-sm font-semibold">Risiko</h3>
              <ul className="text-muted-foreground mt-2 flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed">
                {narrative.risks.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Empat angka yang menentukan keputusan, tanpa kartu: deretan sejajar yang
 * terbaca dalam satu tarikan mata.
 */
export function KeyNumbers({
  audit,
  trust,
  platform,
  engagementMeasurable,
  imputedEngagementRate,
  campaignFromPaid,
}: {
  audit: AuditView;
  trust: AuditTrustView;
  platform: InfluencerPlatform;
  engagementMeasurable: boolean | null;
  imputedEngagementRate: number | null;
  campaignFromPaid: boolean;
}) {
  const erValue =
    engagementMeasurable === false && imputedEngagementRate
      ? `≈ ${pct(imputedEngagementRate)}`
      : engagementMeasurable === false
        ? "—"
        : pct(audit.engagementRate);
  const ratio =
    audit.benchmarkEr && engagementMeasurable !== false
      ? audit.engagementRate / audit.benchmarkEr
      : null;

  const items: { label: string; value: string; note: string }[] = [
    {
      label: "Engagement rate",
      value: erValue,
      note:
        trust.peerPercentile !== null
          ? `Di atas ${trust.peerPercentile}% dari ${trust.peerCount} akun sekelas`
          : trust.erInterval
            ? `Kemungkinan ${pct(trust.erInterval[0])}–${pct(trust.erInterval[1])}`
            : ratio !== null
              ? `${ratio.toFixed(1)}× median tier`
              : "Like + komentar ÷ follower",
    },
    {
      label: "Perkiraan ER campaign",
      value: engagementMeasurable === false ? "—" : pct(audit.expectedCampaignEr),
      note: campaignFromPaid
        ? "Dari post berbayar, disesuaikan jumlah sampelnya"
        : "Dari ER umum — post berbayar belum cukup",
    },
    platform === "TIKTOK" || audit.viewRate !== null
      ? {
          label: "View rate",
          value: pct(audit.viewRate),
          note: "Median view ÷ follower",
        }
      : {
          label: "Follower",
          value: audit.followers.toLocaleString("id-ID"),
          note: "Tanpa data view untuk diukur",
        },
    {
      label: "Ritme posting",
      value: `${audit.postsPerWeek.toLocaleString("id-ID", { maximumFractionDigits: 1 })} per minggu`,
      note:
        audit.daysSinceLastPost !== null
          ? `Terakhir posting ${audit.daysSinceLastPost} hari lalu`
          : "Dari median jarak antar-post",
    },
  ];

  return (
    <dl className="border-border/70 grid grid-cols-2 overflow-hidden rounded-2xl border lg:grid-cols-4">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cn(
            "border-border/60 p-4",
            i % 2 === 1 && "border-l",
            i >= 2 && "border-t lg:border-t-0",
            i === 2 && "lg:border-l",
          )}
        >
          <dt className="text-muted-foreground text-xs">{item.label}</dt>
          <dd className="text-foreground mt-1 text-2xl font-semibold tracking-tight tabular-nums">
            {item.value}
          </dd>
          <dd className="text-muted-foreground mt-1 text-xs leading-snug">{item.note}</dd>
        </div>
      ))}
    </dl>
  );
}
