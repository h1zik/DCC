"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { TrendPhase, TrendRadarStatus } from "@prisma/client";
import { Plus, Radar, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteBrandTrendDigest,
  refreshBrandTrendDigest,
  refreshGlobalBrandTrendDigest,
} from "@/actions/brand-trend-radar";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  TrendSourceConfigPicker,
  validateTrendConfigClient,
} from "@/components/research-hub/trend-source-config-picker";
import { TrendArchiveTable } from "@/components/research-hub/trend-archive-table";
import { TrendQualityBanner } from "@/components/research-hub/trend-quality-banner";
import { TrendSignalStatsLine } from "@/components/research-hub/trend-signal-stats-line";
import { TrendPhaseBoard } from "@/components/research-hub/trend-phase-board";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRelativeTime } from "@/lib/research/labels";
import type { TrendSourceConfig } from "@/lib/research/trend-radar/trend-source-config-types";
import type { TrendSignalStats } from "@/lib/research/trend-radar/trend-signal-types";

export type BrandTrendRadarPageData = {
  latestGlobal: {
    id: string;
    narrative: string | null;
    generatedAt: string | null;
    status: TrendRadarStatus;
    digestMode: string;
    dataNotice: string | null;
    signalStats: TrendSignalStats | null;
    items: {
      id: string;
      name: string;
      phase: TrendPhase;
      dimension: string;
      isGlobalPipeline: boolean;
      tmiScore?: number | null;
      confidence?: string | null;
      wowStatus?: string | null;
    }[];
  } | null;
  digests: {
    id: string;
    weekStart: string;
    weekEnd: string;
    status: TrendRadarStatus;
    isGlobal: boolean;
    brandName: string | null;
    itemCount: number;
    generatedAt: string | null;
  }[];
  globalSourceConfig: TrendSourceConfig;
  tiktokConfigured: boolean;
};

export function BrandTrendRadarClient({ data }: { data: BrandTrendRadarPageData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [seedKeywords, setSeedKeywords] = useState("");
  const [sourceConfig, setSourceConfig] = useState<TrendSourceConfig>(
    data.globalSourceConfig,
  );

  const hasInProgress =
    data.latestGlobal?.status === "COLLECTING" ||
    data.latestGlobal?.status === "ANALYZING" ||
    data.digests.some(
      (d) => d.status === "COLLECTING" || d.status === "ANALYZING",
    );

  useEffect(() => {
    if (!hasInProgress) return;
    const id = window.setInterval(() => router.refresh(), 15_000);
    return () => window.clearInterval(id);
  }, [hasInProgress, router]);

  function handleRefreshGlobal() {
    const validationError = validateTrendConfigClient(sourceConfig);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    startTransition(async () => {
      try {
        await refreshGlobalBrandTrendDigest({
          seedKeywords: seedKeywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
          sourceConfig: sourceConfig as Record<string, unknown>,
        });
        toast.success("Digest tren sedang dibuat — halaman akan diperbarui otomatis.");
        setDialogOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat digest tren."));
      }
    });
  }

  function handleRefreshDigest(digestId: string) {
    startTransition(async () => {
      try {
        await refreshBrandTrendDigest(digestId);
        toast.success("Digest diperbarui.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memperbarui digest."));
      }
    });
  }

  function handleDelete(digestId: string) {
    if (!confirm("Hapus digest ini?")) return;
    startTransition(async () => {
      try {
        await deleteBrandTrendDigest(digestId);
        toast.success("Digest dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus digest."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {data.digests.length} digest tersimpan
          {!data.tiktokConfigured ? " · TikTok Trends belum dikonfigurasi" : ""}
        </p>
        <Button size="sm" onClick={() => setDialogOpen(true)} disabled={pending}>
          <Plus className="size-3.5" aria-hidden />
          Buat Digest Baru
        </Button>
      </div>

      {data.latestGlobal ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
            <div>
              <CardTitle className="text-base">Digest Global Terbaru</CardTitle>
              <TrendSignalStatsLine stats={data.latestGlobal.signalStats} />
              {data.latestGlobal.generatedAt ? (
                <p className="text-muted-foreground text-xs">
                  {formatRelativeTime(new Date(data.latestGlobal.generatedAt))}
                </p>
              ) : null}
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => handleRefreshDigest(data.latestGlobal!.id)}
              >
                <RefreshCw className="size-3.5" aria-hidden />
              </Button>
              <Link
                href={`/brand-hub/trend-radar/${data.latestGlobal.id}`}
                className="inline-flex h-8 items-center justify-center rounded-lg border border-input bg-background px-3 text-xs font-medium shadow-xs hover:bg-accent"
              >
                Detail
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <TrendQualityBanner
              digestMode={data.latestGlobal.digestMode}
              dataNotice={data.latestGlobal.dataNotice}
            />
            {data.latestGlobal.narrative ? (
              <p className="text-sm leading-relaxed">{data.latestGlobal.narrative}</p>
            ) : null}
            <TrendPhaseBoard
              items={data.latestGlobal.items}
              digestId={data.latestGlobal.id}
              basePath="/brand-hub/trend-radar"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Radar className="size-6" />
          </span>
          <p className="text-sm font-semibold">Belum ada digest tren</p>
          <p className="text-muted-foreground text-xs">
            Buat digest pertama untuk mendeteksi tren visual, bahan, dan kategori.
          </p>
        </div>
      )}

      {data.digests.length > 0 ? (
        <TrendArchiveTable
          digests={data.digests.map((d) => ({
            id: d.id,
            weekStart: d.weekStart,
            weekEnd: d.weekEnd,
            status: d.status,
            isGlobal: d.isGlobal,
            watchlistName: d.brandName,
            itemCount: d.itemCount,
            generatedAt: d.generatedAt,
          }))}
          basePath="/brand-hub/trend-radar"
        />
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Buat Digest Tren</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Seed keywords (opsional, pisah koma)</Label>
              <Input
                value={seedKeywords}
                onChange={(e) => setSeedKeywords(e.target.value)}
                placeholder="bodycare, parfum, skincare"
              />
            </div>
            <TrendSourceConfigPicker
              config={sourceConfig}
              onChange={setSourceConfig}
              tiktokConfigured={data.tiktokConfigured}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleRefreshGlobal} disabled={pending}>
              {pending ? "Memproses…" : "Generate Digest"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
