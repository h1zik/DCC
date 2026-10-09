"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  FilterX,
  Link2,
  Plus,
  Radar,
  RefreshCw,
  Search,
  SearchX,
  UserSearch,
} from "lucide-react";
import {
  InfluencerAuditStatus,
  InfluencerPlatform,
  InfluencerTier,
  InfluencerVerdict,
} from "@prisma/client";
import { toast } from "sonner";
import { addInfluencerForAudit } from "@/actions/brand-influencer";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SelectItemDef } from "@/lib/select-option-items";
import { LabEmptyState, LabToolbar } from "@/components/lab/lab-primitives";
import {
  applyInfluencerFilters,
  countActiveInfluencerFilters,
  DEFAULT_INFLUENCER_FILTERS,
  INFLUENCER_RETURN_PARAM,
  VERDICT_GROUP,
  type InfluencerFilterState,
} from "@/lib/brand-research/influencer/list-filter";
import {
  isAuditInProgress,
  TIER_LABEL,
} from "@/components/brand-hub/influencer-badges";
import { brandHubHref, useBrandHubBrandId } from "@/hooks/use-brand-hub-brand-id";
import { useBrandJobProgress } from "../use-brand-job-progress";
import { useInfluencerFilters } from "./use-influencer-filters";
import {
  InfluencerCompactList,
  InfluencerTable,
} from "./influencer-list-views";
import { CompareTray, MAX_COMPARE } from "./influencer-compare";

export type InfluencerRow = {
  id: string;
  platform: InfluencerPlatform;
  handle: string;
  profileUrl: string;
  displayName: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  brandName: string | null;
  auditCount: number;
  latestStatus: InfluencerAuditStatus | null;
  errorMessage: string | null;
  collectedAt: string | null;
  followers: number | null;
  tier: InfluencerTier | null;
  engagementRate: number | null;
  benchmarkEr: number | null;
  score: number | null;
  verdict: InfluencerVerdict | null;
  authenticityScore: number | null;
  confidence: string | null;
  expectedCampaignEr: number | null;
  sponsoredDeltaPct: number | null;
  flagCount: number;
  /** Label risiko asosiasi tingkat berat, mis. "Promosi judi online". */
  severeRisk: string | null;
  /** "Feed" atau "Reels" — permukaan yang jadi dasar ER di kartu ini. */
  primarySurface: string | null;
  /** 1 = metode lama; null = belum ada audit selesai. */
  scoringVersion: number | null;
  /** Rentang skor p10–p90 (metode v2). */
  scoreInterval: [number, number] | null;
  /** Keandalan data 0–100 (metode v2). */
  reliability: number | null;
  /** Persentil ER di antara akun sekelas (metode v2, bila pembanding cukup). */
  peerPercentile: number | null;
};

type HubStats = {
  total: number;
  audited: number;
  recommended: number;
  needsReview: number;
  suspicious: number;
  avgScore: number;
};

function AddInfluencerDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const brandId = useBrandHubBrandId();

  function submit() {
    if (!url.trim()) {
      toast.error("Tempel link profil influencer dulu.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await addInfluencerForAudit({
          url: url.trim(),
          ownerBrandId: brandId,
          notes: notes.trim() || null,
        });
        toast.success(
          result.reused
            ? "Influencer sudah pernah ditambahkan — audit ulang dijalankan."
            : "Influencer ditambahkan, audit sedang berjalan.",
        );
        setUrl("");
        setNotes("");
        setOpen(false);
        onAdded();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menambahkan influencer."));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="gap-1.5">
            <Plus className="size-4" />
            Audit Influencer
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader className="gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_12%,transparent)] text-[var(--lab-accent,var(--primary))]">
              <UserSearch className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <DialogTitle>Audit influencer baru</DialogTitle>
              <DialogDescription>
                Tempel link profil Instagram atau TikTok. Kami ambil post
                terbaru, hitung engagement rate relatif terhadap tier follower,
                dan periksa tanda-tanda engagement yang dibeli.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="inf-url" className="flex items-center gap-1.5">
              <Link2 className="text-muted-foreground size-3.5" />
              Link profil
            </Label>
            <Input
              id="inf-url"
              placeholder="https://www.instagram.com/username"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !pending) submit();
              }}
            />
            <p className="text-muted-foreground text-xs leading-relaxed">
              Harus link <strong>profil</strong>, bukan link post. Contoh:
              instagram.com/username atau tiktok.com/@username
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="inf-notes">
              Catatan{" "}
              <span className="text-muted-foreground font-normal">(opsional)</span>
            </Label>
            <Textarea
              id="inf-notes"
              placeholder="Mis. kandidat kampanye Ramadan, rate card 5jt/post"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={pending} className="gap-1.5">
            {pending ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <UserSearch className="size-4" />
            )}
            Jalankan audit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


const PLATFORM_ITEMS: SelectItemDef[] = [
  { value: "all", label: "Semua platform" },
  { value: InfluencerPlatform.INSTAGRAM, label: "Instagram" },
  { value: InfluencerPlatform.TIKTOK, label: "TikTok" },
];

/**
 * Dua pilihan teratas adalah alur kerja yang sebenarnya: menyaring kandidat
 * yang bisa langsung dipakai, dan mengerjakan antrean yang harus diperiksa.
 * Vonis satuan di bawahnya untuk penelusuran yang lebih spesifik.
 */
const VERDICT_ITEMS: SelectItemDef[] = [
  { value: VERDICT_GROUP.ALL, label: "Semua vonis" },
  { value: VERDICT_GROUP.USABLE, label: "Layak dipakai" },
  { value: VERDICT_GROUP.FLAGGED, label: "Perlu diperiksa" },
  { value: InfluencerVerdict.EXCELLENT, label: "Sangat bagus" },
  { value: InfluencerVerdict.GOOD, label: "Bagus" },
  { value: InfluencerVerdict.AVERAGE, label: "Rata-rata" },
  { value: InfluencerVerdict.POOR, label: "Lemah" },
  { value: InfluencerVerdict.NEEDS_REVIEW, label: "Perlu dicek" },
  { value: InfluencerVerdict.SUSPICIOUS, label: "Mencurigakan" },
  // Daftar ini hanya memuat orang yang auditnya sudah diantre, jadi "belum
  // diaudit" tidak lagi mungkin. Yang tersisa: audit masih jalan atau gagal.
  { value: VERDICT_GROUP.UNAUDITED, label: "Belum ada vonis" },
];

const TIER_ITEMS: SelectItemDef[] = [
  { value: "all", label: "Semua tier" },
  ...(
    [
      InfluencerTier.NANO,
      InfluencerTier.MICRO,
      InfluencerTier.MID,
      InfluencerTier.MACRO,
      InfluencerTier.MEGA,
    ] as const
  ).map((t) => ({ value: t, label: TIER_LABEL[t] })),
];

const SORT_ITEMS: SelectItemDef[] = [
  { value: "recent", label: "Terbaru ditambah" },
  { value: "score", label: "Skor tertinggi" },
  { value: "campaignEr", label: "Perkiraan campaign" },
  { value: "er", label: "ER tertinggi" },
  { value: "followers", label: "Follower terbanyak" },
  { value: "reliability", label: "Data paling andal" },
  { value: "peer", label: "Teratas di antara akun sekelas" },
];

function FilterToolbar({
  filters,
  onChange,
  shown,
  total,
}: {
  filters: InfluencerFilterState;
  onChange: (next: InfluencerFilterState) => void;
  shown: number;
  total: number;
}) {
  const activeCount = countActiveInfluencerFilters(filters);

  function set<K extends keyof InfluencerFilterState>(
    key: K,
    value: InfluencerFilterState[K],
  ) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-col gap-2">
      <LabToolbar>
        <div className="relative min-w-[180px] flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Cari username atau nama…"
            aria-label="Cari influencer"
            className="h-8 pl-8 text-xs"
          />
        </div>

        <Select
          value={filters.platform}
          items={PLATFORM_ITEMS}
          onValueChange={(v) =>
            set("platform", (v as InfluencerFilterState["platform"]) ?? "all")
          }
        >
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLATFORM_ITEMS.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.verdict}
          items={VERDICT_ITEMS}
          onValueChange={(v) => set("verdict", v ?? VERDICT_GROUP.ALL)}
        >
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VERDICT_ITEMS.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.tier}
          items={TIER_ITEMS}
          onValueChange={(v) =>
            set("tier", (v as InfluencerFilterState["tier"]) ?? "all")
          }
        >
          <SelectTrigger className="h-8 w-[165px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIER_ITEMS.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.sort}
          items={SORT_ITEMS}
          onValueChange={(v) =>
            set("sort", (v as InfluencerFilterState["sort"]) ?? "recent")
          }
        >
          <SelectTrigger className="h-8 w-[170px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_ITEMS.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {activeCount > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-8 gap-1.5 text-xs"
            onClick={() => onChange(DEFAULT_INFLUENCER_FILTERS)}
          >
            <FilterX className="size-3.5" />
            Kosongkan ({activeCount})
          </Button>
        ) : null}
      </LabToolbar>

      <p className="text-muted-foreground px-1 text-xs">
        {shown === total
          ? `${total} influencer`
          : `Menampilkan ${shown} dari ${total} influencer`}
      </p>
    </div>
  );
}

function SummaryCount({
  value,
  label,
  tone,
  verdict,
  active,
  onPick,
}: {
  value: number;
  label: string;
  tone: string;
  verdict: string;
  active: boolean;
  onPick: (verdict: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(verdict)}
      aria-pressed={active}
      disabled={value === 0}
      className="focus-visible:ring-ring/50 rounded-md px-0.5 underline-offset-4 outline-none hover:underline focus-visible:ring-2 disabled:pointer-events-none aria-pressed:underline"
      style={{ color: value > 0 ? tone : undefined }}
    >
      <span className="font-semibold tabular-nums">{value}</span> {label}
    </button>
  );
}

/**
 * Ringkasan sebagai satu kalimat, dengan tiap angka sebagai pintasan filter:
 * yang ingin dilakukan orang setelah membaca "3 perlu dicek" adalah melihat
 * ketiganya.
 */
function SummaryLine({
  stats,
  filters,
  onChange,
}: {
  stats: HubStats;
  filters: InfluencerFilterState;
  onChange: (next: InfluencerFilterState) => void;
}) {
  const pick = (verdict: string) =>
    onChange({
      ...filters,
      verdict: filters.verdict === verdict ? VERDICT_GROUP.ALL : verdict,
    });

  const countProps = (verdict: string) => ({
    verdict,
    active: filters.verdict === verdict,
    onPick: pick,
  });

  if (stats.audited === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {stats.total} influencer sedang diaudit.
      </p>
    );
  }

  return (
    <p className="text-foreground text-base leading-relaxed sm:text-lg">
      <span className="font-semibold tabular-nums">{stats.audited}</span> dari{" "}
      {stats.total} influencer sudah selesai diaudit:{" "}
      <SummaryCount
        value={stats.recommended}
        label="layak dipakai"
        tone="var(--iv-go)"
        {...countProps(VERDICT_GROUP.USABLE)}
      />
      ,{" "}
      <SummaryCount
        value={stats.needsReview}
        label="perlu dicek"
        tone="var(--iv-review)"
        {...countProps(InfluencerVerdict.NEEDS_REVIEW)}
      />
      , dan{" "}
      <SummaryCount
        value={stats.suspicious}
        label="mencurigakan"
        tone="var(--iv-fraud)"
        {...countProps(InfluencerVerdict.SUSPICIOUS)}
      />
      .
    </p>
  );
}

export function InfluencerAuditClient({
  profiles,
  stats,
}: {
  profiles: InfluencerRow[];
  stats: HubStats;
}) {
  const router = useRouter();
  const brandId = useBrandHubBrandId();
  const anyRunning = profiles.some((p) => isAuditInProgress(p.latestStatus));
  // Filter hidup di URL, bukan di state komponen: membuka satu influencer lalu
  // kembali tidak boleh menghapus penyaringan yang sudah dipasang.
  const { filters, setFilters, query: filterQuery } = useInfluencerFilters();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useBrandJobProgress({ inProgress: anyRunning });

  const refresh = () => router.refresh();

  const visible = useMemo(
    () => applyInfluencerFilters(profiles, filters),
    [profiles, filters],
  );

  // Profil yang sudah dihapus atau kembali diaudit keluar dari pilihan.
  const selectedRows = selectedIds
    .map((id) => profiles.find((p) => p.id === id))
    .filter(
      (p): p is InfluencerRow =>
        !!p && p.latestStatus === InfluencerAuditStatus.READY,
    );
  const selectedSet = new Set(selectedRows.map((r) => r.id));

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= MAX_COMPARE
          ? prev
          : [...prev, id],
    );
  }

  const hrefFor = (row: InfluencerRow) =>
    brandHubHref(`/brand-hub/influencer-audit/${row.id}`, brandId) +
    (filterQuery
      ? `${brandId ? "&" : "?"}${INFLUENCER_RETURN_PARAM}=${encodeURIComponent(filterQuery)}`
      : "");

  const listProps = {
    rows: visible,
    hrefFor,
    selected: selectedSet,
    onToggle: toggle,
    selectionFull: selectedSet.size >= MAX_COMPARE,
    onChanged: refresh,
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SummaryLine stats={stats} filters={filters} onChange={setFilters} />
        <AddInfluencerDialog onAdded={refresh} />
      </div>

      {profiles.length === 0 ? (
        <LabEmptyState
          icon={UserSearch}
          title="Belum ada influencer yang diaudit"
          description="Tempel link profil Instagram atau TikTok. Kami hitung engagement rate terhadap follower dan terhadap view, bandingkan dengan akun sekelas, lalu periksa tanda-tanda engagement yang dibeli. Belum punya nama yang mau diperiksa? Cari dulu di KOL Radar."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <AddInfluencerDialog onAdded={refresh} />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                render={
                  <Link href={brandHubHref("/brand-hub/kol-radar", brandId)} />
                }
              >
                <Radar className="size-4" aria-hidden />
                Cari di KOL Radar
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <FilterToolbar
            filters={filters}
            onChange={setFilters}
            shown={visible.length}
            total={profiles.length}
          />

          {visible.length === 0 ? (
            <LabEmptyState
              icon={SearchX}
              title="Tidak ada influencer yang cocok"
              description="Tidak ada yang memenuhi kombinasi filter ini. Longgarkan salah satu filternya, atau kosongkan semuanya."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setFilters(DEFAULT_INFLUENCER_FILTERS)}
                >
                  <FilterX className="size-4" />
                  Kosongkan filter
                </Button>
              }
            />
          ) : (
            <>
              <InfluencerTable {...listProps} />
              <InfluencerCompactList {...listProps} />
            </>
          )}

          <CompareTray
            rows={selectedRows}
            onRemove={toggle}
            onClear={() => setSelectedIds([])}
          />
        </>
      )}
    </div>
  );
}
