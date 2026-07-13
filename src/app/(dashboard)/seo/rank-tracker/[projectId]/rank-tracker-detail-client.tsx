"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EChartsOption } from "echarts";
import { SeoRankDevice } from "@prisma/client";
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Plus,
  RefreshCw,
  LineChart as LineChartIcon,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EChart } from "@/components/research-hub/echart";
import { SeoDetailPage } from "@/components/seo/seo-module-page";
import {
  ResearchHubEmptyState,
  hub,
} from "@/components/research-hub/research-hub-primitives";
import { SEO_DEVICE_LABELS, formatRankPosition } from "@/lib/seo/labels";
import { rankChangeKind } from "@/lib/seo/rank-tracker/rank-change";
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

const CHART_COLORS = [
  "#6366f1",
  "#22c55e",
  "#ef4444",
  "#f59e0b",
  "#06b6d4",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#3b82f6",
];

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

function ChangeCell({
  prev,
  next,
}: {
  prev: number | null;
  next: number | null;
}) {
  const kind = rankChangeKind(prev, next);
  if (kind === "up")
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
        <ArrowUpRight className="size-3.5" />
        {Math.abs((next ?? 0) - (prev ?? 0))}
      </span>
    );
  if (kind === "down")
    return (
      <span className="inline-flex items-center gap-0.5 text-red-600 dark:text-red-400">
        <ArrowDownRight className="size-3.5" />
        {Math.abs((next ?? 0) - (prev ?? 0))}
      </span>
    );
  if (kind === "entered")
    return <span className="text-emerald-600 dark:text-emerald-400">baru</span>;
  if (kind === "dropped")
    return <span className="text-red-600 dark:text-red-400">keluar</span>;
  return <Minus className="size-3.5 text-muted-foreground" />;
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

  const visibilityOption = useMemo<EChartsOption | null>(() => {
    if (insights.visibilitySeries.length < 2) return null;
    return {
      tooltip: { trigger: "axis" },
      grid: { left: 36, right: 12, top: 12, bottom: 24 },
      xAxis: { type: "category", data: insights.visibilitySeries.map((p) => p.date) },
      yAxis: { type: "value", min: 0 },
      series: [
        {
          type: "line",
          smooth: true,
          areaStyle: { opacity: 0.15 },
          showSymbol: false,
          data: insights.visibilitySeries.map((p) => p.score),
          itemStyle: { color: "#6366f1" },
        },
      ],
    };
  }, [insights.visibilitySeries]);

  const chartOption = useMemo<EChartsOption | null>(() => {
    const series = keywords
      .filter((k) => k.points.some((p) => p.position != null))
      .map((k, i) => ({
        name: k.keyword,
        type: "line" as const,
        showSymbol: true,
        symbolSize: 6,
        connectNulls: false,
        lineStyle: { width: 2 },
        itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
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
      title={project.name}
      description={`${project.domain} · ${SEO_DEVICE_LABELS[project.device]} · ${keywords.length} keyword`}
      right={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={project.isActive ? "secondary" : "outline"}>
            {project.isActive ? "Aktif" : "Nonaktif"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckAll}
            disabled={pending || keywords.length === 0}
          >
            <RefreshCw />
            Cek semua
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleActive}
            disabled={pending}
          >
            {project.isActive ? "Nonaktifkan" : "Aktifkan"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/seo/rank-tracker" />}
          >
            <ArrowLeft />
            Kembali
          </Button>
        </div>
      }
    >
      {/* Insight: visibility + distribusi + share of voice */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className={cn(hub.card, "p-4")}>
          <p className={cn(hub.label, "mb-1")}>Visibility score</p>
          <p className="text-4xl font-bold tabular-nums">
            {insights.visibilityNow}
            <span className="text-muted-foreground text-lg font-normal">%</span>
          </p>
          <p className="text-muted-foreground mb-2 text-xs">
            Estimasi pangsa klik dari semua keyword terlacak (berbobot volume).
          </p>
          {visibilityOption ? (
            <EChart option={visibilityOption} height={120} />
          ) : (
            <p className="text-muted-foreground text-xs">
              Tren muncul setelah beberapa hari pelacakan.
            </p>
          )}
        </div>

        <div className={cn(hub.card, "p-4")}>
          <p className={cn(hub.label, "mb-2")}>Distribusi posisi</p>
          <div className="flex flex-col gap-2 text-sm">
            {(
              [
                ["Top 3", insights.distribution.top3],
                ["Posisi 4–10", insights.distribution.top10],
                ["Posisi 11–20", insights.distribution.top20],
                ["Posisi 21–100", insights.distribution.top100],
                ["Belum ranking", insights.distribution.unranked],
              ] as const
            ).map(([label, count]) => {
              const total = keywords.length || 1;
              return (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-muted-foreground w-28 shrink-0 text-xs">
                    {label}
                  </span>
                  <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${(count / total) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-xs tabular-nums">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className={cn(hub.card, "p-4")}>
          <p className={cn(hub.label, "mb-2")}>Share of voice</p>
          {insights.shareOfVoice.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Tambahkan domain kompetitor di bawah — posisinya diambil dari SERP
              yang sama tanpa biaya ekstra.
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
                        "w-32 shrink-0 truncate text-xs",
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
                          isOwn ? "bg-primary" : "bg-muted-foreground/50",
                        )}
                        style={{ width: `${(s.visibility / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs tabular-nums">
                      {s.visibility}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cannibalization */}
      {insights.cannibalization.length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
            ⚠️ Kemungkinan keyword cannibalization (
            {insights.cannibalization.length})
          </p>
          <div className="flex flex-col gap-2">
            {insights.cannibalization.slice(0, 5).map((c) => (
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
          <p className="text-muted-foreground mt-2 text-xs">
            Solusi umum: gabungkan konten yang tumpang tindih, atau perjelas
            fokus keyword tiap halaman + internal link ke halaman utama.
          </p>
        </div>
      ) : null}

      {/* Kompetitor */}
      <div className={cn(hub.panel, "grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end")}>
        <div className="grid gap-1.5">
          <Label>Domain kompetitor (maks 5, pisahkan dengan koma)</Label>
          <Input
            value={competitorsInput}
            onChange={(e) => setCompetitorsInput(e.target.value)}
            placeholder="kompetitor-a.com, kompetitor-b.co.id"
            disabled={pending}
          />
        </div>
        <Button variant="outline" onClick={handleSaveCompetitors} disabled={pending}>
          Simpan kompetitor
        </Button>
      </div>

      {/* Tambah keyword */}
      <div className={cn(hub.panel, "grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end")}>
        <div className="grid gap-1.5">
          <Label>Tambah keyword</Label>
          <Input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="mis. serum vitamin c"
            disabled={pending}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Target URL (opsional)</Label>
          <Input
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            placeholder="/produk/serum-vitamin-c"
            disabled={pending}
          />
        </div>
        <Button onClick={handleAdd} disabled={pending}>
          <Plus />
          Tambah
        </Button>
      </div>

      {/* Grafik tren posisi */}
      {chartOption ? (
        <div className={hub.panel}>
          <p className={cn(hub.label, "mb-2")}>Tren posisi (90 hari)</p>
          <EChart option={chartOption} height={320} />
          <p className="text-muted-foreground mt-1 text-[11px]">
            Posisi lebih kecil = lebih baik (sumbu dibalik).
          </p>
        </div>
      ) : null}

      {/* Tabel keyword */}
      {keywords.length === 0 ? (
        <ResearchHubEmptyState
          icon={LineChartIcon}
          title="Belum ada keyword"
          description="Tambah keyword di atas untuk mulai melacak posisinya."
        />
      ) : (
        <div className={cn(hub.card, "overflow-x-auto p-4")}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead className="text-right">Vol</TableHead>
                <TableHead className="text-right">Posisi</TableHead>
                <TableHead className="text-center">Perubahan</TableHead>
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
              {keywords.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">
                    {k.keyword}
                    {k.targetUrl ? (
                      <span className="text-muted-foreground block text-xs">
                        {k.targetUrl}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right text-xs tabular-nums">
                    {k.searchVolume != null
                      ? k.searchVolume.toLocaleString("id-ID")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {k.lastPosition != null ? (
                      formatRankPosition(k.lastPosition)
                    ) : k.lastCheckedAt ? (
                      <span
                        className="text-muted-foreground font-normal"
                        title="Di luar top 100"
                      >
                        100+
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex justify-center tabular-nums">
                      <ChangeCell prev={k.previousPosition} next={k.lastPosition} />
                    </span>
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
                            ? "text-red-600 dark:text-red-400"
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
                        <span className="text-muted-foreground text-xs">—</span>
                      ) : (
                        k.features.slice(0, 4).map((f) => (
                          <Badge key={f} variant="outline" className="text-[10px]">
                            {prettyFeature(f)}
                          </Badge>
                        ))
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
                          className={cn(checkingId === k.id && "animate-spin")}
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
      )}
    </SeoDetailPage>
  );
}
