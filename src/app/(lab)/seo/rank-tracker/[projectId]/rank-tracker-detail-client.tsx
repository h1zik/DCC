"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EChartsOption } from "echarts";
import { SeoRankDevice } from "@prisma/client";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Plus,
  RefreshCw,
  LineChart as LineChartIcon,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EChart } from "@/components/lab/echart";
import { SeoDetailPage } from "@/components/seo/seo-module-page";
import { SeoSparkline } from "@/components/seo/seo-sparkline";
import { LabEmptyState, lab } from "@/components/lab/lab-primitives";
import { SEO_DEVICE_LABELS, formatRankPosition } from "@/lib/seo/labels";
import { rankChangeKind } from "@/lib/seo/rank-tracker/rank-change";
import type { SelectItemDef } from "@/lib/select-option-items";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  addTrackedKeyword,
  checkProjectRanks,
  checkRankNow,
  removeTrackedKeyword,
  toggleRankProjectActive,
  updateProjectCompetitors,
} from "@/actions/seo-rank-tracker";
import { cn } from "@/lib/utils";

export type TrackedKeywordRow = {
  id: string;
  keyword: string;
  targetUrl: string | null;
  searchVolume: number | null;
  lastPosition: number | null;
  previousPosition: number | null;
  lastFoundUrl: string | null;
  lastCheckedAt: string | null;
  features: string[];
  competitorPositions: Record<string, number | null>;
  points: { t: string; position: number | null }[];
};

type ProjectInfo = {
  id: string;
  name: string;
  domain: string;
  device: SeoRankDevice;
  isActive: boolean;
  competitors: string[];
};

export type RankInsights = {
  visibilityNow: number;
  visibilitySeries: { date: string; score: number }[];
  shareOfVoice: { domain: string; visibility: number }[];
  distribution: {
    top3: number;
    top10: number;
    top20: number;
    top100: number;
    unranked: number;
  };
  cannibalization: {
    keyword: string;
    urls: string[];
    severity: "high" | "medium";
    evidence: string;
  }[];
};

type SortKey = "position" | "change" | "volume" | "keyword";

const SORT_ITEMS: SelectItemDef[] = [
  { value: "position", label: "Posisi terbaik" },
  { value: "change", label: "Perubahan terbesar" },
  { value: "volume", label: "Volume tertinggi" },
  { value: "keyword", label: "Abjad" },
];

const DIST_SEGMENTS = [
  { key: "top3", label: "Top 3", dot: "bg-emerald-500" },
  { key: "top10", label: "Posisi 4–10", dot: "bg-teal-500" },
  { key: "top20", label: "Posisi 11–20", dot: "bg-amber-400" },
  { key: "top100", label: "Posisi 21–100", dot: "bg-slate-400 dark:bg-slate-500" },
  { key: "unranked", label: "Belum ranking", dot: "bg-muted-foreground/25" },
] as const;

function prettyFeature(type: string): string {
  return type.replace(/_/g, " ");
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "Belum dicek";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Badge posisi dengan tone per jenjang (top 3 → hijau, hal. 1 → teal, dst.). */
function PositionBadge({
  position,
  checked,
}: {
  position: number | null;
  checked: boolean;
}) {
  if (position == null) {
    if (!checked) return <span className="text-muted-foreground">—</span>;
    return (
      <span
        className="bg-muted/70 text-muted-foreground inline-flex min-w-11 items-center justify-center rounded-lg px-2 py-1 text-xs font-semibold tabular-nums"
        title="Di luar top 100"
      >
        100+
      </span>
    );
  }
  const tone =
    position <= 3
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : position <= 10
        ? "bg-teal-500/15 text-teal-700 dark:text-teal-300"
        : position <= 20
          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
          : "bg-muted/70 text-foreground/80";
  return (
    <span
      className={cn(
        "inline-flex min-w-11 items-center justify-center rounded-lg px-2 py-1 text-sm font-bold tabular-nums",
        tone,
      )}
    >
      #{position}
    </span>
  );
}

function ChangeCell({
  prev,
  next,
}: {
  prev: number | null;
  next: number | null;
}) {
  const kind = rankChangeKind(prev, next);
  const pill =
    "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums";
  if (kind === "up")
    return (
      <span
        className={cn(
          pill,
          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        )}
      >
        <ArrowUpRight className="size-3" />
        {Math.abs((next ?? 0) - (prev ?? 0))}
      </span>
    );
  if (kind === "down")
    return (
      <span
        className={cn(pill, "bg-rose-500/10 text-rose-700 dark:text-rose-300")}
      >
        <ArrowDownRight className="size-3" />
        {Math.abs((next ?? 0) - (prev ?? 0))}
      </span>
    );
  if (kind === "entered")
    return (
      <span
        className={cn(
          pill,
          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        )}
      >
        baru
      </span>
    );
  if (kind === "dropped")
    return (
      <span
        className={cn(pill, "bg-rose-500/10 text-rose-700 dark:text-rose-300")}
      >
        keluar
      </span>
    );
  return <Minus className="text-muted-foreground size-3.5" />;
}

export function RankTrackerDetailClient({
  project,
  keywords,
  insights,
}: {
  project: ProjectInfo;
  keywords: TrackedKeywordRow[];
  insights: RankInsights;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newKeyword, setNewKeyword] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [competitorsInput, setCompetitorsInput] = useState(
    project.competitors.join(", "),
  );
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("position");

  /* -------------------------------- Statistik hero ------------------------------- */
  const stats = useMemo(() => {
    const ranked = keywords
      .map((k) => k.lastPosition)
      .filter((x): x is number => x != null);
    const avgPosition = ranked.length
      ? Math.round((ranked.reduce((a, b) => a + b, 0) / ranked.length) * 10) /
        10
      : null;
    let up = 0;
    let down = 0;
    for (const k of keywords) {
      const kind = rankChangeKind(k.previousPosition, k.lastPosition);
      if (kind === "up" || kind === "entered") up += 1;
      else if (kind === "down" || kind === "dropped") down += 1;
    }
    const lastChecked = keywords.reduce<string | null>(
      (acc, k) =>
        k.lastCheckedAt && (!acc || k.lastCheckedAt > acc)
          ? k.lastCheckedAt
          : acc,
      null,
    );
    return { avgPosition, up, down, lastChecked };
  }, [keywords]);

  const distTotal = keywords.length || 1;

  /* --------------------------- Tabel: filter + sortir --------------------------- */
  const visibleKeywords = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = keywords.filter(
      (k) =>
        !q ||
        k.keyword.toLowerCase().includes(q) ||
        (k.targetUrl ?? "").toLowerCase().includes(q),
    );
    const pos = (k: TrackedKeywordRow) => k.lastPosition ?? 101;
    const delta = (k: TrackedKeywordRow) =>
      (k.previousPosition ?? 101) - (k.lastPosition ?? 101);
    const sorted = [...list];
    switch (sortBy) {
      case "position":
        sorted.sort((a, b) => pos(a) - pos(b));
        break;
      case "change":
        sorted.sort((a, b) => Math.abs(delta(b)) - Math.abs(delta(a)));
        break;
      case "volume":
        sorted.sort((a, b) => (b.searchVolume ?? -1) - (a.searchVolume ?? -1));
        break;
      case "keyword":
        sorted.sort((a, b) => a.keyword.localeCompare(b.keyword, "id"));
        break;
    }
    return sorted;
  }, [keywords, query, sortBy]);

  const chartOption = useMemo<EChartsOption | null>(() => {
    const series = keywords
      .filter((k) => k.points.some((p) => p.position != null))
      .map((k) => ({
        name: k.keyword,
        type: "line" as const,
        showSymbol: true,
        symbolSize: 6,
        connectNulls: false,
        lineStyle: { width: 2 },
        data: k.points.map((p) => [p.t, p.position] as [string, number | null]),
      }));

    if (series.length === 0) return null;

    return {
      tooltip: { trigger: "axis" },
      legend: { type: "scroll", top: 0 },
      grid: { left: 44, right: 16, top: 36, bottom: 28 },
      xAxis: { type: "time" },
      yAxis: {
        type: "value",
        inverse: true,
        min: 1,
        name: "Posisi",
        nameTextStyle: { align: "left" },
      },
      series,
    };
  }, [keywords]);

  /* ---------------------------------- Handlers ---------------------------------- */
  function handleAdd() {
    if (!newKeyword.trim()) {
      toast.error("Keyword wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await addTrackedKeyword({
          projectId: project.id,
          keyword: newKeyword.trim(),
          targetUrl: newTarget.trim() || undefined,
        });
        setNewKeyword("");
        setNewTarget("");
        toast.success("Keyword ditambahkan — cek posisi berjalan.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menambah keyword."));
      }
    });
  }

  function handleCheckOne(id: string) {
    setCheckingId(id);
    startTransition(async () => {
      try {
        const res = await checkRankNow(id);
        toast.success(
          res.position != null
            ? `Posisi: ${formatRankPosition(res.position)}`
            : "Tidak masuk top 100.",
        );
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal cek ranking."));
      } finally {
        setCheckingId(null);
      }
    });
  }

  function handleCheckAll() {
    startTransition(async () => {
      try {
        await checkProjectRanks(project.id);
        toast.success("Cek semua keyword berjalan di background.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menjalankan cek."));
      }
    });
  }

  function handleToggleActive() {
    startTransition(async () => {
      try {
        await toggleRankProjectActive(project.id, !project.isActive);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengubah status."));
      }
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      try {
        await removeTrackedKeyword(id);
        toast.success("Keyword dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  function handleSaveCompetitors() {
    startTransition(async () => {
      try {
        const { competitors } = await updateProjectCompetitors({
          projectId: project.id,
          competitors: competitorsInput
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
        });
        setCompetitorsInput(competitors.join(", "));
        toast.success(
          competitors.length
            ? `${competitors.length} kompetitor dilacak mulai cek berikutnya.`
            : "Daftar kompetitor dikosongkan.",
        );
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan kompetitor."));
      }
    });
  }

  return (
    <SeoDetailPage
      icon={LineChartIcon}
      backHref="/seo/rank-tracker"
      title={project.name}
      description={`${project.domain} · ${SEO_DEVICE_LABELS[project.device]} · ${keywords.length} keyword · Terakhir dicek ${formatDateTime(stats.lastChecked)}`}
      right={
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
              project.isActive
                ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                : "bg-muted text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                project.isActive ? "bg-emerald-500" : "bg-muted-foreground/50",
              )}
            />
            {project.isActive ? "Pelacakan aktif" : "Nonaktif"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleActive}
            disabled={pending}
          >
            {project.isActive ? "Nonaktifkan" : "Aktifkan"}
          </Button>
          <Button
            size="sm"
            onClick={handleCheckAll}
            disabled={pending || keywords.length === 0}
          >
            <RefreshCw />
            Cek semua
          </Button>
        </div>
      }
    >
      {/* Papan bento: visibility, distribusi, stat */}
      <div className="grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Visibility — tile hero teal */}
        <div className="bento-tile col-span-2 row-span-2 border-transparent bg-teal-600 shadow-md shadow-teal-600/20 lg:col-span-1 dark:bg-teal-500">
          <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
            Visibility score
          </span>
          <span className="bento-value text-5xl text-white dark:text-teal-950">
            {insights.visibilityNow}
            <span className="text-2xl font-bold text-teal-200/80 dark:text-teal-900/60">
              %
            </span>
          </span>
          {insights.visibilitySeries.length >= 2 ? (
            <div className="text-white/90 dark:text-teal-950/70">
              <SeoSparkline
                values={insights.visibilitySeries.map((p) => p.score)}
                className="h-9"
              />
            </div>
          ) : null}
          <span className="text-[11px] font-medium leading-snug text-teal-100/90 dark:text-teal-900/80">
            estimasi pangsa klik, berbobot volume · 30 hari
          </span>
        </div>

        {/* Distribusi posisi */}
        <div className="bento-tile col-span-2 row-span-2 justify-start gap-3">
          <div className="flex items-center justify-between">
            <span className="bento-label">Distribusi posisi</span>
            <span className="text-muted-foreground text-[11px] tabular-nums">
              {keywords.length} keyword
            </span>
          </div>
          <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
            {DIST_SEGMENTS.map((s) => {
              const count = insights.distribution[s.key];
              if (count === 0) return null;
              return (
                <div
                  key={s.key}
                  className={s.dot}
                  style={{ width: `${(count / distTotal) * 100}%` }}
                  title={`${s.label}: ${count}`}
                />
              );
            })}
          </div>
          <div className="flex flex-col gap-1.5">
            {DIST_SEGMENTS.map((s) => {
              const count = insights.distribution[s.key];
              return (
                <div key={s.key} className="flex items-center gap-2 text-xs">
                  <span
                    className={cn("size-2 shrink-0 rounded-full", s.dot)}
                    aria-hidden
                  />
                  <span className="text-muted-foreground flex-1">
                    {s.label}
                  </span>
                  <span className="font-semibold tabular-nums">{count}</span>
                  <span className="text-muted-foreground w-10 text-right text-[11px] tabular-nums">
                    {Math.round((count / distTotal) * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Posisi rata-rata */}
        <div className="bento-tile">
          <span className="bento-label">Posisi rata-rata</span>
          <span className="bento-value">
            {stats.avgPosition != null
              ? formatRankPosition(Math.round(stats.avgPosition))
              : "—"}
          </span>
        </div>

        {/* Perubahan */}
        <div className="bento-tile">
          <span className="bento-label">Perubahan terakhir</span>
          <span className="flex items-baseline gap-3">
            <span className="bento-value text-2xl text-emerald-600 dark:text-emerald-400">
              ▲{stats.up}
            </span>
            <span className="bento-value text-2xl text-rose-600 dark:text-rose-400">
              ▼{stats.down}
            </span>
          </span>
        </div>
      </div>

      {/* Share of voice + cannibalization */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="bento-tile justify-start gap-3">
          <div className="flex items-center justify-between">
            <span className="bento-label">Share of voice</span>
            <span className="text-muted-foreground text-[11px]">
              dari SERP yang sama, tanpa biaya ekstra
            </span>
          </div>
          {insights.shareOfVoice.length === 0 ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Tambahkan domain kompetitor di bawah — posisinya ikut terekam
              setiap kali cek ranking berjalan.
            </p>
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              {insights.shareOfVoice.map((s) => {
                const max = insights.shareOfVoice[0]?.visibility || 1;
                const isOwn = s.domain === project.domain;
                return (
                  <div key={s.domain} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-36 shrink-0 truncate text-xs",
                        isOwn ? "font-semibold" : "text-muted-foreground",
                      )}
                      title={s.domain}
                    >
                      {s.domain}
                      {isOwn ? " (Anda)" : ""}
                    </span>
                    <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          isOwn ? "bg-primary" : "bg-muted-foreground/40",
                        )}
                        style={{ width: `${(s.visibility / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums">
                      {s.visibility}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="border-border/60 mt-auto flex flex-col gap-2 border-t pt-3 sm:flex-row">
            <Input
              value={competitorsInput}
              onChange={(e) => setCompetitorsInput(e.target.value)}
              placeholder="kompetitor-a.com, kompetitor-b.co.id (maks 5)"
              className="h-9 flex-1 text-xs"
              disabled={pending}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveCompetitors}
              disabled={pending}
            >
              Simpan kompetitor
            </Button>
          </div>
        </div>

        {insights.cannibalization.length > 0 ? (
          <div className="flex flex-col gap-2.5 rounded-[1.25rem] border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
              <TriangleAlert className="size-4" />
              Kemungkinan keyword cannibalization (
              {insights.cannibalization.length})
            </p>
            <div className="flex flex-col gap-2">
              {insights.cannibalization.slice(0, 4).map((c) => (
                <div key={c.keyword} className="text-sm">
                  <span className="font-medium">“{c.keyword}”</span>{" "}
                  <span className="text-muted-foreground text-xs">
                    {c.evidence}
                  </span>
                  <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 text-xs">
                    {c.urls.slice(0, 3).map((u) => (
                      <span key={u} className="truncate">
                        {u.replace(/^https?:\/\//, "")}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground mt-auto text-xs">
              Solusi umum: gabungkan konten yang tumpang tindih, atau perjelas
              fokus keyword tiap halaman + internal link ke halaman utama.
            </p>
          </div>
        ) : (
          <div className="bento-tile justify-start gap-3">
            <span className="bento-label">Keyword cannibalization</span>
            <div className="flex items-center gap-2.5 text-sm text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="size-4.5 shrink-0" />
              Tidak ada indikasi — tiap keyword konsisten dilayani satu URL.
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Kami memantau URL yang muncul di SERP per keyword; jika satu
              keyword dilayani beberapa URL bergantian, peringatan muncul di
              sini.
            </p>
          </div>
        )}
      </div>

      {/* Grafik tren posisi */}
      {chartOption ? (
        <div className="bento-tile justify-start gap-2">
          <div className="flex items-center justify-between">
            <span className="bento-label">Tren posisi · 90 hari</span>
            <span className="text-muted-foreground text-[11px]">
              posisi lebih kecil = lebih baik (sumbu dibalik)
            </span>
          </div>
          <EChart option={chartOption} height={320} />
        </div>
      ) : null}

      {/* Tabel keyword */}
      {keywords.length === 0 ? (
        <LabEmptyState
          icon={LineChartIcon}
          title="Belum ada keyword"
          description="Tambahkan keyword pertama untuk mulai melacak posisinya di Google."
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="mis. serum vitamin c"
                className="h-9 sm:w-64"
                disabled={pending}
              />
              <Button size="sm" onClick={handleAdd} disabled={pending}>
                <Plus />
                Tambah keyword
              </Button>
            </div>
          }
        />
      ) : (
        <div className={cn(lab.card, "p-0")}>
          {/* Toolbar tabel */}
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-foreground font-bold tracking-tight">
                Keyword terlacak
              </p>
              <p className="text-muted-foreground text-xs">
                {visibleKeywords.length === keywords.length
                  ? `${keywords.length} keyword`
                  : `${visibleKeywords.length} dari ${keywords.length} keyword`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari keyword…"
                  className="h-9 w-48 pl-8 text-xs"
                />
              </div>
              <Select
                value={sortBy}
                items={SORT_ITEMS}
                onValueChange={(v) => {
                  if (v) setSortBy(v as SortKey);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  Urutkan:{" "}
                  {SORT_ITEMS.find((i) => i.value === sortBy)?.label ?? ""}
                </SelectTrigger>
                <SelectContent>
                  {SORT_ITEMS.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead className="text-right">Posisi</TableHead>
                  <TableHead className="text-center">Perubahan</TableHead>
                  <TableHead>Tren 90 hari</TableHead>
                  <TableHead className="text-right">Vol</TableHead>
                  {project.competitors.map((c) => (
                    <TableHead key={c} className="text-right" title={c}>
                      <span className="block max-w-24 truncate">{c}</span>
                    </TableHead>
                  ))}
                  <TableHead>SERP features</TableHead>
                  <TableHead>Terakhir dicek</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleKeywords.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">
                      {k.keyword}
                      {k.targetUrl ? (
                        <span className="text-muted-foreground block max-w-52 truncate text-xs">
                          {k.targetUrl}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <PositionBadge
                        position={k.lastPosition}
                        checked={k.lastCheckedAt != null}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <ChangeCell
                        prev={k.previousPosition}
                        next={k.lastPosition}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="text-primary w-24">
                        <SeoSparkline
                          values={k.points.map((p) => p.position)}
                          invert
                          showArea={false}
                          className="h-7"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right text-xs tabular-nums">
                      {k.searchVolume != null
                        ? k.searchVolume.toLocaleString("id-ID")
                        : "—"}
                    </TableCell>
                    {project.competitors.map((c) => {
                      const pos = k.competitorPositions[c] ?? null;
                      const better =
                        pos != null &&
                        (k.lastPosition == null || pos < k.lastPosition);
                      return (
                        <TableCell
                          key={c}
                          className={cn(
                            "text-right text-xs tabular-nums",
                            better
                              ? "font-semibold text-rose-600 dark:text-rose-400"
                              : "text-muted-foreground",
                          )}
                        >
                          {pos != null ? `#${pos}` : "—"}
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {k.features.length === 0 ? (
                          <span className="text-muted-foreground text-xs">
                            —
                          </span>
                        ) : (
                          <>
                            {k.features.slice(0, 3).map((f) => (
                              <Badge
                                key={f}
                                variant="outline"
                                className="text-[10px]"
                              >
                                {prettyFeature(f)}
                              </Badge>
                            ))}
                            {k.features.length > 3 ? (
                              <Badge
                                variant="outline"
                                className="text-[10px]"
                                title={k.features
                                  .slice(3)
                                  .map(prettyFeature)
                                  .join(", ")}
                              >
                                +{k.features.length - 3}
                              </Badge>
                            ) : null}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDateTime(k.lastCheckedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCheckOne(k.id)}
                          disabled={pending}
                        >
                          <RefreshCw
                            className={cn(
                              checkingId === k.id && "animate-spin",
                            )}
                          />
                          Cek
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemove(k.id)}
                          disabled={pending}
                          aria-label="Hapus keyword"
                        >
                          <Trash2 className="text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Tambah keyword inline */}
          <div className="border-border/60 flex flex-col gap-2 border-t p-3 sm:flex-row sm:items-center">
            <Plus className="text-muted-foreground hidden size-4 shrink-0 sm:block" />
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              placeholder="Tambah keyword… (mis. serum vitamin c)"
              className="h-9 flex-1 text-sm"
              disabled={pending}
            />
            <Input
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              placeholder="Target URL (opsional)"
              className="h-9 flex-1 text-sm"
              disabled={pending}
            />
            <Button size="sm" onClick={handleAdd} disabled={pending}>
              <Plus />
              Tambah
            </Button>
          </div>
        </div>
      )}
    </SeoDetailPage>
  );
}
