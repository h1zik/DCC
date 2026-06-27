"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EChartsOption } from "echarts";
import { SeoAnalysisStatus } from "@prisma/client";
import { ArrowLeft, Link2, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import {
  ResearchHubStatChip,
  hub,
} from "@/components/research-hub/research-hub-primitives";
import { isSeoStatusBusy } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  addBacklinkGap,
  deleteBacklinkGap,
  refreshSeoBacklinkProfile,
} from "@/actions/seo-backlinks";
import { cn } from "@/lib/utils";

type GapDomain = { domain: string; rank: number | null; backlinks: number | null };

export type BacklinkDetail = {
  id: string;
  name: string;
  target: string;
  status: SeoAnalysisStatus;
  summary: Record<string, unknown> | null;
  topReferringDomains: {
    domain: string;
    rank: number | null;
    backlinks: number | null;
  }[];
  topAnchors: { anchor: string; backlinks: number | null; referringDomains: number | null }[];
  history: {
    date: string;
    backlinks: number | null;
    referringDomains: number | null;
  }[];
  dataNotice: string | null;
  errorMessage: string | null;
  gaps: {
    id: string;
    competitor: string;
    status: SeoAnalysisStatus;
    gapCount: number;
    gapDomains: GapDomain[];
    errorMessage: string | null;
  }[];
};

function num(value: unknown): string {
  return typeof value === "number" ? value.toLocaleString("id-ID") : "—";
}

export function BacklinksDetailClient({ profile }: { profile: BacklinkDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const [competitor, setCompetitor] = useState("");

  const busy = isSeoStatusBusy(profile.status);
  const anyGapBusy = profile.gaps.some((g) => isSeoStatusBusy(g.status));
  useEffect(() => {
    if (!busy && !anyGapBusy) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [busy, anyGapBusy, router]);

  const s = profile.summary ?? {};

  const chartOption = useMemo<EChartsOption | null>(() => {
    const pts = profile.history.filter(
      (h) => h.backlinks != null || h.referringDomains != null,
    );
    if (pts.length < 2) return null;
    return {
      tooltip: { trigger: "axis" },
      legend: { top: 0 },
      grid: { left: 50, right: 16, top: 30, bottom: 28 },
      xAxis: { type: "time" },
      yAxis: { type: "value" },
      series: [
        {
          name: "Backlinks",
          type: "line",
          showSymbol: false,
          itemStyle: { color: "#6366f1" },
          data: pts.map((h) => [h.date, h.backlinks] as [string, number | null]),
        },
        {
          name: "Referring domains",
          type: "line",
          showSymbol: false,
          itemStyle: { color: "#22c55e" },
          data: pts.map(
            (h) => [h.date, h.referringDomains] as [string, number | null],
          ),
        },
      ],
    };
  }, [profile.history]);

  function handleRefresh() {
    setRefreshing(true);
    startTransition(async () => {
      try {
        await refreshSeoBacklinkProfile(profile.id);
        toast.success("Analisis ulang dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh."));
      } finally {
        setRefreshing(false);
      }
    });
  }

  function handleAddGap() {
    if (!competitor.trim()) {
      toast.error("Domain kompetitor wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await addBacklinkGap({ profileId: profile.id, competitor: competitor.trim() });
        setCompetitor("");
        toast.success("Menghitung backlink gap…");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menambah gap."));
      }
    });
  }

  function handleDeleteGap(id: string) {
    startTransition(async () => {
      try {
        await deleteBacklinkGap(id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus gap."));
      }
    });
  }

  return (
    <SeoDetailPage
      icon={Link2}
      title={profile.name}
      description={profile.target}
      right={
        <div className="flex items-center gap-2">
          <SeoStatusBadge status={profile.status} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={pending || refreshing || busy}
          >
            <RefreshCw className={cn(refreshing && "animate-spin")} />
            Analisis ulang
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/seo/backlinks" />}>
            <ArrowLeft />
            Kembali
          </Button>
        </div>
      }
    >
      {profile.status === SeoAnalysisStatus.FAILED && profile.errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {profile.errorMessage}
        </div>
      ) : null}
      {profile.dataNotice ? (
        <div className={cn(hub.nestedPanel, "text-muted-foreground text-sm")}>
          {profile.dataNotice}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <ResearchHubStatChip label="Rank" value={num(s.rank)} tone="primary" />
        <ResearchHubStatChip label="Backlinks" value={num(s.backlinks)} />
        <ResearchHubStatChip label="Ref. domains" value={num(s.referringDomains)} />
        <ResearchHubStatChip label="Dofollow" value={num(s.dofollow)} tone="success" />
        <ResearchHubStatChip label="Broken" value={num(s.brokenBacklinks)} tone="warning" />
        <ResearchHubStatChip label="Spam score" value={num(s.spamScore)} />
      </div>

      {chartOption ? (
        <div className={hub.panel}>
          <p className={cn(hub.label, "mb-2")}>Tren backlink</p>
          <EChart option={chartOption} height={280} />
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className={cn(hub.card, "overflow-x-auto p-4")}>
          <p className="mb-3 font-semibold">Top referring domains</p>
          {profile.topReferringDomains.length === 0 ? (
            <p className="text-muted-foreground text-sm">Belum ada data.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead className="text-right">Rank</TableHead>
                  <TableHead className="text-right">Backlinks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profile.topReferringDomains.slice(0, 20).map((d) => (
                  <TableRow key={d.domain}>
                    <TableCell className="max-w-[240px] truncate text-sm">
                      {d.domain}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{num(d.rank)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(d.backlinks)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className={cn(hub.card, "overflow-x-auto p-4")}>
          <p className="mb-3 font-semibold">Top anchor text</p>
          {profile.topAnchors.length === 0 ? (
            <p className="text-muted-foreground text-sm">Belum ada data.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anchor</TableHead>
                  <TableHead className="text-right">Backlinks</TableHead>
                  <TableHead className="text-right">Ref. domain</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profile.topAnchors.slice(0, 20).map((a, i) => (
                  <TableRow key={`${a.anchor}-${i}`}>
                    <TableCell className="max-w-[240px] truncate text-sm">
                      {a.anchor}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(a.backlinks)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(a.referringDomains)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Backlink gap */}
      <div className={cn(hub.card, "p-4")}>
        <p className="mb-3 font-semibold">Backlink gap vs kompetitor</p>
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div className="grid flex-1 gap-1.5">
            <Label>Domain kompetitor</Label>
            <Input
              value={competitor}
              onChange={(e) => setCompetitor(e.target.value)}
              placeholder="kompetitor.com"
              disabled={pending}
            />
          </div>
          <Button onClick={handleAddGap} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Plus />}
            Hitung gap
          </Button>
        </div>

        {profile.gaps.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Tambahkan kompetitor untuk melihat domain yang menaut ke mereka tapi
            belum ke kamu.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {profile.gaps.map((gap) => (
              <div key={gap.id} className={cn(hub.nestedPanel)}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-medium">{gap.competitor}</span>
                  <div className="flex items-center gap-2">
                    {isSeoStatusBusy(gap.status) ? (
                      <SeoStatusBadge status={gap.status} />
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        {gap.gapCount} domain gap
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteGap(gap.id)}
                      disabled={pending}
                      aria-label="Hapus gap"
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                </div>
                {gap.errorMessage ? (
                  <p className="text-destructive text-xs">{gap.errorMessage}</p>
                ) : gap.gapDomains.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {gap.gapDomains.slice(0, 15).map((d) => (
                      <span
                        key={d.domain}
                        className="rounded-md border border-border/50 bg-muted/40 px-2 py-0.5 text-xs"
                      >
                        {d.domain}
                      </span>
                    ))}
                    {gap.gapDomains.length > 15 ? (
                      <span className="text-muted-foreground px-1 text-xs">
                        +{gap.gapDomains.length - 15} lagi
                      </span>
                    ) : null}
                  </div>
                ) : !isSeoStatusBusy(gap.status) ? (
                  <p className="text-muted-foreground text-xs">
                    Tidak ada gap — kamu sudah punya semua referring domain mereka. 🎉
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </SeoDetailPage>
  );
}
