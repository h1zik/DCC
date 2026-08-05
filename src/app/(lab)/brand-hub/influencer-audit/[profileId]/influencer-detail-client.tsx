"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Clapperboard,
  ExternalLink,
  Eye,
  Heart,
  LayoutGrid,
  Megaphone,
  MessageCircle,
  RefreshCw,
  Save,
  Share2,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  InfluencerAuditStatus,
  InfluencerPlatform,
  InfluencerTier,
  InfluencerVerdict,
} from "@prisma/client";
import { toast } from "sonner";
import {
  reauditInfluencer,
  updateInfluencerNotes,
} from "@/actions/brand-influencer";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { lab, LabEmptyState, LabSection } from "@/components/lab/lab-primitives";
import {
  AuditStatusPill,
  compactNumber,
  ConfidenceBadge,
  FakeFlagList,
  InfluencerAvatar,
  isAuditInProgress,
  parseFakeFlags,
  PLATFORM_LABEL,
  PostThumbnail,
  ScoreRing,
  TIER_LABEL,
  VerdictBadge,
} from "@/components/brand-hub/influencer-badges";
import { InfluencerMethodology } from "@/components/brand-hub/influencer-methodology";
import { useBrandJobProgress } from "../../use-brand-job-progress";
import { cn } from "@/lib/utils";

export type PostView = {
  id: string;
  url: string | null;
  caption: string | null;
  thumbnailUrl: string | null;
  mediaType: string | null;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  saves: number;
  engagementRate: number;
  isSponsored: boolean;
  inSample: boolean;
  surface: string;
  isPinned: boolean;
  postedAt: string | null;
};

export type AuditView = {
  id: string;
  status: InfluencerAuditStatus;
  errorMessage: string | null;
  createdAt: string;
  collectedAt: string | null;
  followers: number;
  following: number;
  postCount: number;
  tier: InfluencerTier | null;
  postsFetched: number;
  postsAnalyzed: number;
  sampleWindowDays: number | null;
  confidence: string;
  medianLikes: number;
  medianComments: number;
  medianShares: number;
  medianViews: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  avgViews: number;
  engagementRate: number;
  totalEngagementRate: number;
  viewEngagementRate: number | null;
  viewRate: number | null;
  feedPostCount: number;
  reelsPostCount: number;
  reelsEngagementRate: number | null;
  postsPerWeek: number;
  daysSinceLastPost: number | null;
  sponsoredCount: number;
  organicCount: number;
  sponsoredEr: number | null;
  organicEr: number | null;
  sponsoredDeltaPct: number | null;
  expectedCampaignEr: number;
  score: number;
  verdict: InfluencerVerdict | null;
  benchmarkEr: number | null;
  authenticityScore: number;
  fakeFlags: unknown;
  metrics: unknown;
  aiSummary: string | null;
  posts: PostView[];
};

export type ProfileView = {
  id: string;
  platform: InfluencerPlatform;
  handle: string;
  profileUrl: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isVerified: boolean;
  notes: string | null;
  brandName: string | null;
};

type Narrative = {
  strengths?: string[];
  risks?: string[];
  recommendation?: string;
};

function readNarrative(metrics: unknown): Narrative | null {
  if (!metrics || typeof metrics !== "object") return null;
  const n = (metrics as { narrative?: unknown }).narrative;
  if (!n || typeof n !== "object") return null;
  return n as Narrative;
}

function readNumber(metrics: unknown, key: string): number | null {
  if (!metrics || typeof metrics !== "object") return null;
  const v = (metrics as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function readString(metrics: unknown, key: string): string | null {
  if (!metrics || typeof metrics !== "object") return null;
  const v = (metrics as Record<string, unknown>)[key];
  return typeof v === "string" ? v : null;
}

/** Rincian komponen skor untuk panel metodologi. */
function readComponents(metrics: unknown) {
  if (!metrics || typeof metrics !== "object") return null;
  const c = (metrics as { components?: unknown }).components;
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;
  const pick = (key: string): number =>
    typeof o[key] === "number" && Number.isFinite(o[key]) ? (o[key] as number) : 0;
  return {
    engagement: pick("engagement"),
    consistency: pick("consistency"),
    reach: pick("reach"),
    authenticity: pick("authenticity"),
    performancePenalty: pick("performancePenalty"),
  };
}

function pct(value: number | null, digits = 2): string {
  if (value === null) return "—";
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: digits })}%`;
}

function MetricTile({
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
        tone === "good" && "border-emerald-300/50 bg-emerald-50/40 dark:border-emerald-500/20 dark:bg-emerald-500/5",
        tone === "warn" && "border-amber-300/50 bg-amber-50/40 dark:border-amber-500/20 dark:bg-amber-500/5",
        tone === "bad" && "border-rose-300/50 bg-rose-50/40 dark:border-rose-500/20 dark:bg-rose-500/5",
      )}
    >
      <p className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
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
 * Batang ER dibanding median tier. Median digambar sebagai garis acuan supaya
 * angka ER terbaca relatif, bukan sebagai angka absolut yang menyesatkan.
 */
function BenchmarkBar({
  er,
  benchmark,
}: {
  er: number;
  benchmark: number;
}) {
  // Skala penuh = 2× median; di atas itu batang mentok.
  const full = benchmark * 2;
  const erPct = Math.min((er / full) * 100, 100);
  const benchPct = 50;
  const above = er >= benchmark;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-8 w-full overflow-hidden rounded-lg bg-muted/60">
        <div
          className={cn(
            "h-full rounded-lg transition-all",
            above ? "bg-emerald-500/70" : "bg-amber-500/70",
          )}
          style={{ width: `${erPct}%` }}
        />
        <div
          className="bg-foreground/70 absolute inset-y-0 w-0.5"
          style={{ left: `${benchPct}%` }}
          aria-hidden
        />
        <span className="absolute inset-y-0 left-2 flex items-center text-xs font-bold text-foreground">
          {pct(er)}
        </span>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Garis tengah = median tier ini ({pct(benchmark)}).{" "}
        {above ? (
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
            Di atas median {(er / benchmark).toFixed(1)}×.
          </span>
        ) : (
          <span className="font-semibold text-amber-700 dark:text-amber-400">
            Baru {(er / benchmark).toFixed(1)}× median.
          </span>
        )}
      </p>
    </div>
  );
}

/** Grafik garis riwayat ER antar audit. */
function HistoryChart({ audits }: { audits: AuditView[] }) {
  const points = useMemo(
    () =>
      audits
        .filter((a) => a.status === InfluencerAuditStatus.READY)
        .slice()
        .reverse()
        .map((a) => ({
          er: a.engagementRate,
          label: new Date(a.collectedAt ?? a.createdAt).toLocaleDateString(
            "id-ID",
            { day: "numeric", month: "short" },
          ),
        })),
    [audits],
  );

  if (points.length < 2) return null;

  const w = 600;
  const h = 120;
  const pad = 8;
  const max = Math.max(...points.map((p) => p.er)) * 1.15 || 1;
  const stepX = (w - pad * 2) / (points.length - 1);

  const path = points
    .map((p, i) => {
      const x = pad + i * stepX;
      const y = h - pad - (p.er / max) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const first = points[0].er;
  const last = points[points.length - 1].er;
  const delta = first > 0 ? ((last - first) / first) * 100 : 0;

  return (
    <div className={cn(lab.nestedPanel, "flex flex-col gap-3")}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-foreground text-sm font-semibold">
          Riwayat engagement rate
        </p>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            delta >= 0
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-500/15 text-rose-700 dark:text-rose-300",
          )}
        >
          {delta >= 0 ? (
            <TrendingUp className="size-3" aria-hidden />
          ) : (
            <TrendingDown className="size-3" aria-hidden />
          )}
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(1)}%
        </span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-28 w-full"
        role="img"
        aria-label={`Tren engagement rate dari ${points.length} audit`}
        preserveAspectRatio="none"
      >
        <path
          d={path}
          fill="none"
          strokeWidth={2.5}
          className="stroke-[var(--lab-accent,var(--primary))]"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={pad + i * stepX}
            cy={h - pad - (p.er / max) * (h - pad * 2)}
            r={3}
            className="fill-[var(--lab-accent,var(--primary))]"
          />
        ))}
      </svg>
      <div className="text-muted-foreground flex justify-between text-[10px]">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}

/**
 * Membandingkan dua permukaan Instagram. Selisih besar di antara keduanya
 * bukan tanda buruk — itu memberi tahu format apa yang harus diminta dari
 * influencer ini, tergantung tujuan kampanyenya.
 */
function SurfacePanel({ audit }: { audit: AuditView }) {
  const feedEr = audit.engagementRate;
  const reelsEr = audit.reelsEngagementRate;
  const feedStronger = reelsEr !== null && feedEr > reelsEr * 1.5;
  const reelsStronger = reelsEr !== null && reelsEr > feedEr * 1.5;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Post feed"
          value={String(audit.feedPostCount)}
          hint={`ER ${pct(feedEr)} terhadap follower`}
          icon={LayoutGrid}
          tone={feedStronger ? "good" : "neutral"}
        />
        <MetricTile
          label="Reels"
          value={String(audit.reelsPostCount)}
          hint={
            reelsEr !== null
              ? `ER ${pct(reelsEr)} terhadap follower`
              : "Engagement Reels tidak terukur"
          }
          icon={Clapperboard}
          tone={reelsStronger ? "good" : "neutral"}
        />
        <MetricTile
          label="Jangkauan Reels"
          value={pct(audit.viewRate)}
          hint="View dibagi follower"
          icon={Eye}
        />
        <MetricTile
          label="ER per view Reels"
          value={pct(audit.viewEngagementRate)}
          hint="Seberapa banyak penonton ikut berinteraksi"
          icon={Eye}
        />
      </div>

      {feedStronger ? (
        <p className="rounded-xl border border-sky-300/60 bg-sky-50/60 p-3.5 text-xs leading-relaxed text-sky-900 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-200">
          <strong>Audiensnya berinteraksi di feed, bukan di Reels.</strong> Kalau
          target Anda engagement, minta post feed atau carousel. Reels-nya lebih
          cocok dipakai untuk menjangkau orang baru.
        </p>
      ) : null}
      {reelsStronger ? (
        <p className="rounded-xl border border-sky-300/60 bg-sky-50/60 p-3.5 text-xs leading-relaxed text-sky-900 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-200">
          <strong>Kekuatannya ada di Reels.</strong> Reels-nya menghasilkan
          engagement lebih tinggi daripada post feed — arahkan kerja sama ke
          format video.
        </p>
      ) : null}

      <p className="text-muted-foreground text-xs leading-relaxed">
        Angka engagement utama dihitung dari post feed, sedangkan jangkauan
        dihitung dari Reels — dua-duanya diambil dari koleksi masing-masing.
        Grid profil dikurasi pemiliknya dan hitungan view di sana tidak dapat
        dipercaya, jadi Reels diambil lewat panggilan terpisah.
      </p>
    </div>
  );
}

function SponsoredPanel({ audit }: { audit: AuditView }) {
  const comparable = audit.sponsoredEr !== null && audit.organicEr !== null;
  const delta = audit.sponsoredDeltaPct;

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

      <p className="text-muted-foreground text-xs leading-relaxed">
        Deteksi berbayar membaca label paid partnership dan hashtag seperti #ad,
        #endorse, #kerjasama. <strong>Angka ini batas bawah</strong> — influencer
        yang tidak mencantumkan penanda akan terhitung organik, sehingga
        penurunan sesungguhnya bisa lebih besar.
      </p>
    </div>
  );
}

function PostTable({ posts }: { posts: PostView[] }) {
  if (posts.length === 0) return null;

  return (
    <div className="border-border/60 overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-muted/40">
          <tr className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
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
          {posts.map((p) => (
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
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                          <Clapperboard className="size-2.5" aria-hidden />
                          Reels
                        </span>
                      ) : (
                        <span className="bg-muted/70 text-muted-foreground inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                          <LayoutGrid className="size-2.5" aria-hidden />
                          Feed
                        </span>
                      )}
                      {p.isPinned ? (
                        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                          Dipin
                        </span>
                      ) : null}
                      {p.isSponsored ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                          <Megaphone className="size-2.5" aria-hidden />
                          Berbayar
                        </span>
                      ) : null}
                      {!p.inSample ? (
                        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
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
                {compactNumber(p.likes)}
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
                {pct(p.engagementRate)}
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
  );
}

function NotesEditor({
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

export function InfluencerDetailClient({
  profile,
  audits,
}: {
  profile: ProfileView;
  audits: AuditView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const latest = audits[0] ?? null;
  const running = isAuditInProgress(latest?.status);

  useBrandJobProgress({ inProgress: running });

  const readyAudit =
    audits.find((a) => a.status === InfluencerAuditStatus.READY) ?? null;
  const readyAuditCount = audits.filter(
    (a) => a.status === InfluencerAuditStatus.READY,
  ).length;

  function reaudit() {
    startTransition(async () => {
      try {
        await reauditInfluencer(profile.id);
        toast.success("Audit ulang dijalankan.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menjalankan audit ulang."));
      }
    });
  }

  const flags = parseFakeFlags(readyAudit?.fakeFlags);
  const narrative = readNarrative(readyAudit?.metrics);
  const trendPct = readNumber(readyAudit?.metrics, "engagementTrendPct");
  const commentLikeRatio = readNumber(readyAudit?.metrics, "commentLikeRatio");
  const viralSkew = readNumber(readyAudit?.metrics, "viralSkew");
  const campaignSource = readString(
    readyAudit?.metrics,
    "expectedCampaignErSource",
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Kartu identitas + skor */}
      <div className={cn(lab.panel, "flex flex-wrap items-start gap-5")}>
        <InfluencerAvatar
          src={profile.avatarUrl}
          handle={profile.handle}
          className="size-16 text-lg"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-foreground flex items-center gap-1.5 text-lg font-bold">
              @{profile.handle}
              {profile.isVerified ? (
                <BadgeCheck className="size-4 text-sky-500" aria-hidden />
              ) : null}
            </p>
            <VerdictBadge verdict={readyAudit?.verdict ?? null} />
            <AuditStatusPill status={latest?.status ?? null} />
            {readyAudit ? (
              <ConfidenceBadge confidence={readyAudit.confidence} />
            ) : null}
            {readyAudit?.tier ? (
              <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-[11px] font-semibold">
                {TIER_LABEL[readyAudit.tier]}
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {PLATFORM_LABEL[profile.platform]}
            {profile.displayName ? ` · ${profile.displayName}` : ""}
            {profile.brandName ? ` · ${profile.brandName}` : ""}
          </p>
          {profile.bio ? (
            <p className="text-muted-foreground mt-2 line-clamp-2 text-xs leading-relaxed">
              {profile.bio}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={reaudit}
              disabled={pending || running}
              className="gap-1.5"
            >
              <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
              Audit ulang
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              render={
                <a
                  href={profile.profileUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                />
              }
            >
              Buka profil
              <ExternalLink className="size-3.5" />
            </Button>
          </div>
        </div>

        {readyAudit ? (
          <ScoreRing
            score={readyAudit.score}
            verdict={readyAudit.verdict}
            size={84}
          />
        ) : null}
      </div>

      {running ? (
        <JobProgressBar
          percent={latest?.status === InfluencerAuditStatus.ANALYZING ? 75 : 40}
          title="Audit berjalan"
          stepLabel={
            latest?.status === InfluencerAuditStatus.ANALYZING
              ? "Menilai engagement & keaslian audiens…"
              : "Mengambil profil dan post terbaru dari Apify…"
          }
        />
      ) : null}

      {latest?.status === InfluencerAuditStatus.FAILED && latest.errorMessage ? (
        <p className="rounded-xl border border-rose-300/60 bg-rose-50/60 p-4 text-sm leading-relaxed text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200">
          <strong className="font-semibold">Audit gagal.</strong>{" "}
          {latest.errorMessage}
        </p>
      ) : null}

      {!readyAudit ? (
        !running && latest?.status !== InfluencerAuditStatus.FAILED ? (
          <LabEmptyState
            icon={Sparkles}
            title="Belum ada hasil audit"
            description="Jalankan audit untuk mengambil post terbaru dan menghitung engagement."
          />
        ) : null
      ) : (
        <>
          <LabSection
            title="Metrik engagement"
            description={`Angka pusat memakai median dari ${readyAudit.postsAnalyzed} post (dari ${readyAudit.postsFetched} yang diambil${readyAudit.sampleWindowDays !== null ? `, mencakup ${readyAudit.sampleWindowDays} hari` : ""}). Median dipakai agar satu post viral tidak menaikkan angkanya.`}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricTile
                label="Follower"
                value={compactNumber(readyAudit.followers)}
                hint={`Mengikuti ${compactNumber(readyAudit.following)}`}
              />
              <MetricTile
                label="ER standar"
                value={pct(readyAudit.engagementRate)}
                hint={
                  readyAudit.benchmarkEr
                    ? `Like+komentar ÷ follower. Median tier: ${pct(readyAudit.benchmarkEr)}`
                    : "Like+komentar ÷ follower"
                }
                tone={
                  readyAudit.benchmarkEr &&
                  readyAudit.engagementRate >= readyAudit.benchmarkEr
                    ? "good"
                    : "warn"
                }
              />
              <MetricTile
                label="ER penuh"
                value={pct(readyAudit.totalEngagementRate)}
                hint="Termasuk share & simpan — tidak sebanding dengan benchmark"
              />
              <MetricTile
                label="Perkiraan campaign"
                value={pct(readyAudit.expectedCampaignEr)}
                hint={
                  campaignSource === "sponsored"
                    ? "Dari post berbayar influencer ini"
                    : "Dari ER umum — post berbayar belum cukup"
                }
                icon={Megaphone}
                tone={campaignSource === "sponsored" ? "good" : "neutral"}
              />
              <MetricTile
                label="ER terhadap view"
                value={pct(readyAudit.viewEngagementRate)}
                hint="Angka yang paling dekat dengan performa nyata"
                icon={Eye}
              />
              <MetricTile
                label="View rate"
                value={pct(readyAudit.viewRate)}
                hint="View dibagi follower — di bawah 10% mencurigakan"
                icon={Eye}
                tone={
                  readyAudit.viewRate === null
                    ? "neutral"
                    : readyAudit.viewRate < 10
                      ? "bad"
                      : "good"
                }
              />
              <MetricTile
                label="Like (median)"
                value={compactNumber(readyAudit.medianLikes)}
                hint={
                  viralSkew !== null && viralSkew > 1.3
                    ? `Rata-rata ${compactNumber(readyAudit.avgLikes)} — ${viralSkew.toFixed(1)}× median`
                    : `Rata-rata ${compactNumber(readyAudit.avgLikes)}`
                }
                icon={Heart}
                tone={viralSkew !== null && viralSkew > 2 ? "warn" : "neutral"}
              />
              <MetricTile
                label="Komentar (median)"
                value={compactNumber(readyAudit.medianComments)}
                hint={
                  commentLikeRatio !== null
                    ? `${(commentLikeRatio * 100).toFixed(1)}% dari like`
                    : undefined
                }
                icon={MessageCircle}
              />
              <MetricTile
                label="Share (median)"
                value={
                  readyAudit.medianShares > 0
                    ? compactNumber(readyAudit.medianShares)
                    : "—"
                }
                icon={Share2}
              />
              <MetricTile
                label="Ritme posting"
                value={`${readyAudit.postsPerWeek.toLocaleString("id-ID", { maximumFractionDigits: 1 })}/mgg`}
                hint={
                  readyAudit.daysSinceLastPost !== null
                    ? `Jarak antar-post (median). Terakhir posting ${readyAudit.daysSinceLastPost} hari lalu`
                    : "Dari median jarak antar-post"
                }
              />
            </div>

            {readyAudit.benchmarkEr ? (
              <div className={cn(lab.nestedPanel, "mt-3")}>
                <p className="text-foreground mb-3 text-sm font-semibold">
                  Posisi terhadap median tier {readyAudit.tier ? TIER_LABEL[readyAudit.tier] : ""}
                </p>
                <BenchmarkBar
                  er={readyAudit.engagementRate}
                  benchmark={readyAudit.benchmarkEr}
                />
              </div>
            ) : null}
          </LabSection>

          {profile.platform === InfluencerPlatform.INSTAGRAM &&
          readyAudit.reelsPostCount > 0 ? (
            <LabSection
              title="Feed vs Reels"
              description="Di Instagram, grid profil dan tab Reels adalah dua koleksi terpisah dengan perilaku berbeda — digabung jadi satu angka, keduanya saling menutupi."
            >
              <SurfacePanel audit={readyAudit} />
            </LabSection>
          ) : null}

          <LabSection
            title="Post berbayar vs organik"
            description="Post endorse hampir selalu lebih rendah engagement-nya. Angka berbayar inilah yang akan Anda dapat, bukan ER umumnya."
          >
            <SponsoredPanel audit={readyAudit} />
          </LabSection>

          <LabSection
            title="Sinyal peringatan"
            description={`Skor keaslian ${readyAudit.authenticityScore}/100. Sinyal dikelompokkan menurut apa yang dipertanyakannya.`}
          >
            <FakeFlagList flags={flags} />
          </LabSection>

          {readyAudit.aiSummary || narrative ? (
            <LabSection
              title="Penilaian"
              description="Ringkasan naratif dari metrik di atas."
            >
              <div className={cn(lab.nestedPanel, "flex flex-col gap-4")}>
                {readyAudit.aiSummary ? (
                  <p className="text-foreground text-sm leading-relaxed">
                    {readyAudit.aiSummary}
                  </p>
                ) : null}

                {narrative?.strengths?.length ? (
                  <div>
                    <p className={lab.label}>Kekuatan</p>
                    <ul className="text-muted-foreground mt-1.5 flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed">
                      {narrative.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {narrative?.risks?.length ? (
                  <div>
                    <p className={lab.label}>Risiko</p>
                    <ul className="text-muted-foreground mt-1.5 flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed">
                      {narrative.risks.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {narrative?.recommendation ? (
                  <div className="border-border/60 border-t pt-3">
                    <p className={lab.label}>Rekomendasi</p>
                    <p className="text-foreground mt-1.5 text-sm font-medium leading-relaxed">
                      {narrative.recommendation}
                    </p>
                  </div>
                ) : null}
              </div>
            </LabSection>
          ) : null}

          {/*
            Syaratnya audit yang BERHASIL, bukan sekadar jumlah audit: dua
            audit yang salah satunya gagal tidak menghasilkan garis apa pun,
            dan seksi ini akan tampil kosong.
          */}
          {readyAuditCount > 1 ? (
            <LabSection
              title="Riwayat audit"
              description="Satu titik untuk tiap kali audit dijalankan — bukan tren postingan. Engagement influencer bisa berubah antara saat di-scout dan saat dikontrak, jadi jalankan audit ulang menjelang deal."
            >
              <HistoryChart audits={audits} />
            </LabSection>
          ) : null}

          <LabSection
            title="Metodologi"
            description="Penilaian otomatis yang tidak bisa ditelusuri tidak layak dipakai memutuskan pembayaran — semua rumus dan ambangnya terbuka di sini."
          >
            <InfluencerMethodology
              audit={readyAudit}
              components={readComponents(readyAudit.metrics)}
            />
          </LabSection>

          <LabSection
            title="Post yang dianalisis"
            description={
              trendPct !== null
                ? `Tren engagement post terbaru vs terlama: ${trendPct >= 0 ? "+" : ""}${trendPct.toFixed(1)}%.`
                : undefined
            }
          >
            <PostTable posts={readyAudit.posts} />
          </LabSection>
        </>
      )}

      <LabSection title="Catatan internal">
        <NotesEditor profileId={profile.id} initial={profile.notes} />
      </LabSection>
    </div>
  );
}
