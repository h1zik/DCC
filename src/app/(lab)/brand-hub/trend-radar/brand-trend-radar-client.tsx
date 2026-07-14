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
import {
  TREND_RADAR_STATUS_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
import type { TrendSourceConfig } from "@/lib/research/trend-radar/trend-source-config-types";
import type { TrendSignalStats } from "@/lib/research/trend-radar/trend-signal-types";
import {
  lab,
  LabEmptyState,
  LabSection,
  LabStatChip,
} from "@/components/lab/lab-primitives";
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

function statusChipTone(
  status: TrendRadarStatus | null | undefined,
): "neutral" | "success" | "warning" | "accent" {
  switch (status) {
    case "READY":
      return "success";
    case "FAILED":
      return "warning";
    case "COLLECTING":
    case "ANALYZING":
    case "PENDING":
      return "warning";
    default:
      return "neutral";
  }
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
      <div className="flex flex-wrap gap-2">
        <LabStatChip
          label="Digest global"
          value={
            globalJobStatus
              ? TREND_RADAR_STATUS_LABELS[globalJobStatus]
              : data.latestGlobal
                ? TREND_RADAR_STATUS_LABELS[data.latestGlobal.status]
                : "Belum ada"
          }
          tone={statusChipTone(globalJobStatus ?? data.latestGlobal?.status)}
        />
        {data.latestGlobal?.signalStats ? (
          <LabStatChip
            label="Sinyal"
            value={data.latestGlobal.signalStats.total.toLocaleString("id-ID")}
            tone="accent"
          />
        ) : null}
        <LabStatChip
          label="Arsip"
          value={data.digests.length.toLocaleString("id-ID")}
        />
        {!data.tiktokConfigured ? (
          <LabStatChip label="TikTok" value="Belum dikonfigurasi" tone="warning" />
        ) : null}
      </div>

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
              <div
                className={cn(
                  lab.panel,
                  "text-muted-foreground text-sm leading-relaxed",
                )}
              >
                {data.latestGlobal.narrative}
              </div>
            ) : null}
            <TrendPhaseBoard
              digestId={data.latestGlobal.id}
              items={data.latestGlobal.items}
              basePath={trendBasePath}
            />
            <div className="flex gap-1 border-t border-border/40 pt-3">
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
          <div className={lab.panel}>
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
