"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TrendPhase, TrendRadarStatus } from "@prisma/client";
import { ExternalLink, Plus, Radar, RefreshCw, Trash2 } from "lucide-react";
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
import { TrendDigestProgressStrip } from "@/components/research-hub/trend-digest-progress-strip";
import { TrendQualityBanner } from "@/components/research-hub/trend-quality-banner";
import { TrendSignalStatsChips } from "@/components/research-hub/trend-signal-stats-line";
import { TrendPhaseBoard } from "@/components/research-hub/trend-phase-board";
import { Button } from "@/components/ui/button";
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
import { lab, LabEmptyState, LabSection } from "@/components/lab/lab-primitives";
import { brandHubHref, useBrandHubBrandId } from "@/hooks/use-brand-hub-brand-id";
import { cn } from "@/lib/utils";
import { useBrandJobProgress } from "../use-brand-job-progress";

export type BrandTrendRadarPageData = {
  globalInProgress: {
    id: string;
    status: TrendRadarStatus;
  } | null;
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

function isRunningStatus(status: TrendRadarStatus | null | undefined) {
  return (
    status === "COLLECTING" || status === "ANALYZING" || status === "PENDING"
  );
}

export function BrandTrendRadarClient({ data }: { data: BrandTrendRadarPageData }) {
  const router = useRouter();
  const brandId = useBrandHubBrandId();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [seedKeywords, setSeedKeywords] = useState("");
  const [sourceConfig, setSourceConfig] = useState<TrendSourceConfig>(
    data.globalSourceConfig,
  );

  const trendBasePath = "/brand-hub/trend-radar";

  const globalJobStatus = data.globalInProgress?.status;

  const hasInProgress =
    globalJobStatus === "COLLECTING" ||
    globalJobStatus === "ANALYZING" ||
    data.digests.some(
      (d) => d.status === "COLLECTING" || d.status === "ANALYZING",
    );

  const progressSubtitle = (() => {
    if (globalJobStatus === "COLLECTING") {
      return "Digest global — mengumpulkan sinyal";
    }
    if (globalJobStatus === "ANALYZING") {
      return "Digest global — menganalisis tren";
    }
    const digest = data.digests.find(
      (d) => d.status === "COLLECTING" || d.status === "ANALYZING",
    );
    if (digest) {
      return `Digest ${digest.isGlobal ? "global" : digest.brandName ?? "brand"} — ${digest.status === "COLLECTING" ? "mengumpulkan" : "menganalisis"}`;
    }
    return null;
  })();

  useBrandJobProgress({ inProgress: hasInProgress });

  /* ------------------------- Agregasi strip ringkasan ------------------------- */
  const trendCount = data.latestGlobal?.items.length ?? 0;
  const totalSignals = data.latestGlobal?.signalStats?.total ?? null;
  const readyDigests = data.digests.filter((d) => d.status === "READY").length;
  const runningDigests = data.digests.filter((d) =>
    isRunningStatus(d.status),
  ).length;
  const failedDigests = data.digests.filter(
    (d) => d.status === "FAILED",
  ).length;
  const hasAnyData = data.latestGlobal != null || data.digests.length > 0;

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
    <div className="flex flex-col gap-6">
      {/* Strip ringkasan bento */}
      {hasAnyData ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          {/* Hero pink — tren terdeteksi */}
          <div className="bento-tile border-transparent bg-pink-600 shadow-md shadow-pink-600/20 dark:bg-pink-500">
            <span className="text-[11.5px] font-semibold text-pink-100 dark:text-pink-950/70">
              Tren terdeteksi
            </span>
            <span className="bento-value text-white dark:text-pink-950">
              {trendCount}
            </span>
            <span className="text-[11px] font-medium leading-snug text-pink-100/90 dark:text-pink-900/80">
              {totalSignals != null
                ? `dari ${totalSignals.toLocaleString("id-ID")} sinyal digest global`
                : data.latestGlobal?.generatedAt
                  ? `digest global ${formatRelativeTime(new Date(data.latestGlobal.generatedAt))}`
                  : "buat digest global untuk mulai"}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Digest siap</span>
            <span className="bento-value">{readyDigests}</span>
            <span className="text-muted-foreground text-[11px] font-medium">
              dari {data.digests.length} digest di arsip
            </span>
          </div>

          {/* Berjalan / gagal — amber atau rose pastel */}
          {failedDigests > 0 && runningDigests === 0 ? (
            <div className="bento-tile border-transparent bg-[#fbdcd7] dark:bg-rose-400/10">
              <span className="text-[11.5px] font-semibold text-rose-800/70 dark:text-rose-200/60">
                Digest gagal
              </span>
              <span className="bento-value text-rose-900 dark:text-rose-300">
                {failedDigests}
              </span>
              <span className="text-[11px] font-medium text-rose-800/60 dark:text-rose-200/50">
                cek arsip lalu generate ulang
              </span>
            </div>
          ) : (
            <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
              <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
                Sedang berjalan
              </span>
              <span className="bento-value text-amber-900 dark:text-amber-300">
                {runningDigests}
              </span>
              <span className="text-[11px] font-medium text-amber-800/60 dark:text-amber-200/50">
                {failedDigests > 0
                  ? `${failedDigests} gagal di arsip`
                  : "digest dalam proses"}
              </span>
            </div>
          )}

          {/* Sinyal — pastel pink */}
          <div className="bento-tile border-transparent bg-[#fde7f1] dark:bg-pink-400/10">
            <span className="text-[11.5px] font-semibold text-pink-800/70 dark:text-pink-200/60">
              Sinyal terkumpul
            </span>
            <span className="bento-value text-pink-900 dark:text-pink-300">
              {totalSignals != null ? totalSignals.toLocaleString("id-ID") : "—"}
            </span>
            <span className="text-[11px] font-medium text-pink-800/60 dark:text-pink-200/50">
              {data.tiktokConfigured
                ? "search · social · market · consumer"
                : "TikTok belum dikonfigurasi"}
            </span>
          </div>
        </div>
      ) : null}

      {hasInProgress ? (
        <TrendDigestProgressStrip subtitle={progressSubtitle} />
      ) : null}

      <LabSection
        title="Digest Global Terbaru"
        description={
          data.latestGlobal?.generatedAt
            ? `Update terakhir: ${formatRelativeTime(new Date(data.latestGlobal.generatedAt))}`
            : "Belum ada digest global"
        }
        action={
          <div className="flex gap-2">
            {data.latestGlobal ? (
              <Button
                size="sm"
                variant="outline"
                render={
                  <Link
                    href={brandHubHref(
                      `/brand-hub/trend-radar/${data.latestGlobal.id}`,
                      brandId,
                    )}
                  />
                }
              >
                <ExternalLink className="size-3.5" aria-hidden />
                Buka digest
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDialogOpen(true)}
              disabled={pending}
            >
              <Plus className="size-3.5" aria-hidden />
              Buat Digest Baru
            </Button>
          </div>
        }
      >
        {data.latestGlobal ? (
          <div className="flex flex-col gap-4">
            <TrendQualityBanner
              digestMode={data.latestGlobal.digestMode}
              dataNotice={data.latestGlobal.dataNotice}
            />
            {data.latestGlobal.signalStats ? (
              <TrendSignalStatsChips stats={data.latestGlobal.signalStats} />
            ) : null}
            {data.latestGlobal.narrative ? (
              <div className="bento-tile justify-start gap-3">
                <span className="bento-label">Narasi digest</span>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {data.latestGlobal.narrative}
                </p>
              </div>
            ) : null}
            <TrendPhaseBoard
              digestId={data.latestGlobal.id}
              items={data.latestGlobal.items}
              basePath={trendBasePath}
            />
            <div className="flex items-center justify-end gap-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => handleRefreshDigest(data.latestGlobal!.id)}
              >
                <RefreshCw className="size-3.5" aria-hidden />
                Refresh
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={pending}
                onClick={() => handleDelete(data.latestGlobal!.id)}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Hapus
              </Button>
            </div>
          </div>
        ) : (
          <LabEmptyState
            icon={Radar}
            title="Belum ada digest tren"
            description="Buat digest pertama untuk mendeteksi tren visual, bahan, dan kategori."
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)} disabled={pending}>
                <Plus className="size-3.5" aria-hidden />
                Buat Digest Baru
              </Button>
            }
          />
        )}
      </LabSection>

      {data.digests.length > 0 ? (
        <LabSection title="Arsip Digest" delayMs={80}>
          <div className={cn(lab.card, "p-0")}>
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
              basePath={trendBasePath}
            />
          </div>
        </LabSection>
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
