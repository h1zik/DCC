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
} from "@/actions/seo-rank-tracker";
import { cn } from "@/lib/utils";

export type TrackedKeywordRow = {
  id: string;
  keyword: string;
  targetUrl: string | null;
  lastPosition: number | null;
  previousPosition: number | null;
  lastFoundUrl: string | null;
  lastCheckedAt: string | null;
  features: string[];
  points: { t: string; position: number | null }[];
};

type ProjectInfo = {
  id: string;
  name: string;
  domain: string;
  device: SeoRankDevice;
  isActive: boolean;
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
}: {
  project: ProjectInfo;
  keywords: TrackedKeywordRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newKeyword, setNewKeyword] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [checkingId, setCheckingId] = useState<string | null>(null);

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
                <TableHead className="text-right">Posisi</TableHead>
                <TableHead className="text-center">Perubahan</TableHead>
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
