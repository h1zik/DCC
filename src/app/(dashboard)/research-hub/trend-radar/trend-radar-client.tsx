"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { TrendPhase, TrendRadarStatus } from "@prisma/client";
import {
  Archive,
  ExternalLink,
  List,
  Pencil,
  Plus,
  Radar,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createTrendWatchlist,
  deleteTrendWatchlist,
  refreshGlobalTrendDigest,
  refreshTrendWatchlist,
  updateTrendWatchlist,
} from "@/actions/research-trend-radar";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TREND_RADAR_STATUS_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
import type { TrendDigestMode } from "@prisma/client";
import type { TrendSignalStats } from "@/lib/research/trend-radar/trend-signal-types";
import type { TrendSourceConfig } from "@/lib/research/trend-radar/trend-source-config-types";
import {
  hub,
  ResearchHubEmptyState,
  ResearchHubSection,
  ResearchHubStatChip,
} from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";

export type TrendRadarPageData = {
  latestGlobal: {
    id: string;
    narrative: string | null;
    generatedAt: string | null;
    status: TrendRadarStatus;
    digestMode: TrendDigestMode | string;
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
    watchlistName: string | null;
    itemCount: number;
    generatedAt: string | null;
  }[];
  watchlists: {
    id: string;
    name: string;
    keywords: string[];
    isActive: boolean;
    sourceConfig: TrendSourceConfig | null;
    latestDigest: {
      id: string;
      status: TrendRadarStatus;
      generatedAt: string | null;
    } | null;
  }[];
  globalSourceConfig: TrendSourceConfig;
  tiktokConfigured: boolean;
};

type DialogMode = "create" | "edit" | "global" | null;

function statusChipTone(
  status: TrendRadarStatus | null | undefined,
): "neutral" | "success" | "warning" | "primary" {
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

const tabContentClass =
  "animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-6 duration-200 motion-reduce:animate-none pt-4";

export function TrendRadarClient({ data }: { data: TrendRadarPageData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editWatchlistId, setEditWatchlistId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [sourceConfig, setSourceConfig] = useState<TrendSourceConfig>(
    data.globalSourceConfig,
  );

  const dialogOpen = dialogMode !== null;

  const hasInProgress =
    data.latestGlobal?.status === "COLLECTING" ||
    data.latestGlobal?.status === "ANALYZING" ||
    data.watchlists.some(
      (w) =>
        w.latestDigest?.status === "COLLECTING" ||
        w.latestDigest?.status === "ANALYZING",
    );

  const progressSubtitle = (() => {
    if (data.latestGlobal?.status === "COLLECTING") {
      return "Digest global — mengumpulkan sinyal";
    }
    if (data.latestGlobal?.status === "ANALYZING") {
      return "Digest global — menganalisis tren";
    }
    const wl = data.watchlists.find(
      (w) =>
        w.latestDigest?.status === "COLLECTING" ||
        w.latestDigest?.status === "ANALYZING",
    );
    if (wl) {
      return `Watchlist "${wl.name}" — ${wl.latestDigest?.status === "COLLECTING" ? "mengumpulkan" : "menganalisis"}`;
    }
    return null;
  })();

  useEffect(() => {
    if (!hasInProgress) return;
    const id = window.setInterval(() => router.refresh(), 15_000);
    return () => window.clearInterval(id);
  }, [hasInProgress, router]);

  function openCreateDialog() {
    setDialogMode("create");
    setEditWatchlistId(null);
    setName("");
    setKeywords("");
    setSourceConfig(data.globalSourceConfig);
  }

  function openEditDialog(watchlist: TrendRadarPageData["watchlists"][number]) {
    setDialogMode("edit");
    setEditWatchlistId(watchlist.id);
    setName(watchlist.name);
    setKeywords(watchlist.keywords.join(", "));
    setSourceConfig(watchlist.sourceConfig ?? data.globalSourceConfig);
  }

  function openGlobalDialog() {
    setDialogMode("global");
    setSourceConfig(data.globalSourceConfig);
  }

  function closeDialog() {
    setDialogMode(null);
    setEditWatchlistId(null);
  }

  function handleRefreshGlobal() {
    const err = validateTrendConfigClient(sourceConfig);
    if (err) {
      toast.error(err);
      openGlobalDialog();
      return;
    }
    startTransition(async () => {
      try {
        await refreshGlobalTrendDigest(sourceConfig);
        toast.success("Digest global sedang di-generate.");
        closeDialog();
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal memproses permintaan."));
      }
    });
  }

  function handleSaveWatchlist() {
    const kw = keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (!name.trim() || kw.length === 0) {
      toast.error("Nama dan minimal 1 keyword diperlukan.");
      return;
    }
    const err = validateTrendConfigClient(sourceConfig);
    if (err) {
      toast.error(err);
      return;
    }

    startTransition(async () => {
      try {
        if (dialogMode === "edit" && editWatchlistId) {
          await updateTrendWatchlist({
            watchlistId: editWatchlistId,
            name: name.trim(),
            keywords: kw,
            sourceConfig,
          });
          toast.success("Watchlist diperbarui.");
        } else {
          await createTrendWatchlist({
            name: name.trim(),
            keywords: kw,
            sourceConfig,
          });
          toast.success("Watchlist dibuat.");
        }
        closeDialog();
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal memproses permintaan."));
      }
    });
  }

  function handleRefreshWatchlist(id: string) {
    const wl = data.watchlists.find((w) => w.id === id);
    const cfg = wl?.sourceConfig ?? data.globalSourceConfig;
    const err = validateTrendConfigClient(cfg);
    if (err) {
      toast.error(err);
      if (wl) openEditDialog(wl);
      return;
    }
    startTransition(async () => {
      try {
        await refreshTrendWatchlist(id);
        toast.success("Digest watchlist sedang di-generate.");
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal memproses permintaan."));
      }
    });
  }

  function handleDeleteWatchlist(id: string) {
    if (!confirm("Hapus watchlist ini?")) return;
    startTransition(async () => {
      try {
        await deleteTrendWatchlist(id);
        toast.success("Watchlist dihapus.");
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal memproses permintaan."));
      }
    });
  }

  const dialogTitle =
    dialogMode === "global"
      ? "Sumber Digest Global"
      : dialogMode === "edit"
        ? "Edit Watchlist"
        : "Tambah Watchlist";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        <ResearchHubStatChip
          label="Digest global"
          value={
            data.latestGlobal
              ? TREND_RADAR_STATUS_LABELS[data.latestGlobal.status]
              : "Belum ada"
          }
          tone={statusChipTone(data.latestGlobal?.status)}
        />
        {data.latestGlobal?.signalStats ? (
          <ResearchHubStatChip
            label="Sinyal"
            value={data.latestGlobal.signalStats.total.toLocaleString("id-ID")}
            tone="primary"
          />
        ) : null}
        <ResearchHubStatChip
          label="Watchlist"
          value={data.watchlists.length.toLocaleString("id-ID")}
        />
        <ResearchHubStatChip
          label="Arsip"
          value={data.digests.length.toLocaleString("id-ID")}
        />
      </div>

      {hasInProgress ? (
        <TrendDigestProgressStrip subtitle={progressSubtitle} />
      ) : null}

      <Tabs defaultValue="global" className="gap-0">
        <div className={cn(hub.stickyToolbar, "pb-0")}>
          <TabsList variant="line" className="h-9 w-full justify-start gap-4">
            <TabsTrigger value="global" className="px-1">
              <Radar className="size-3.5" aria-hidden />
              Digest Global
            </TabsTrigger>
            <TabsTrigger value="watchlist" className="px-1">
              <List className="size-3.5" aria-hidden />
              Watchlist
              {data.watchlists.length > 0 ? (
                <span className="text-muted-foreground ml-1 text-[10px] tabular-nums">
                  {data.watchlists.length}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="archive" className="px-1">
              <Archive className="size-3.5" aria-hidden />
              Arsip
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="global" className={tabContentClass}>
          <ResearchHubSection
            title="Digest Global"
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
                      <Link href={`/research-hub/trend-radar/${data.latestGlobal.id}`} />
                    }
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                    Buka digest
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openGlobalDialog}
                  disabled={pending}
                >
                  <RefreshCw className="size-3.5" aria-hidden />
                  Refresh Global
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
                  <div className={cn(hub.panel, "text-muted-foreground text-sm leading-relaxed")}>
                    {data.latestGlobal.narrative}
                  </div>
                ) : null}
                <TrendPhaseBoard
                  digestId={data.latestGlobal.id}
                  items={data.latestGlobal.items}
                />
              </div>
            ) : (
              <ResearchHubEmptyState
                icon={Radar}
                title="Belum ada digest global"
                description="Klik Refresh Global untuk generate digest mingguan pertama."
                action={
                  <Button size="sm" onClick={openGlobalDialog} disabled={pending}>
                    <RefreshCw className="size-3.5" aria-hidden />
                    Refresh Global
                  </Button>
                }
              />
            )}
          </ResearchHubSection>
        </TabsContent>

        <TabsContent value="watchlist" className={tabContentClass}>
          <ResearchHubSection
            title="Watchlist"
            description="Pantau kategori atau bahan spesifik"
            delayMs={80}
            action={
              <Button size="sm" variant="outline" onClick={openCreateDialog}>
                <Plus className="size-3.5" aria-hidden />
                Tambah
              </Button>
            }
          >
            {data.watchlists.length === 0 ? (
              <ResearchHubEmptyState
                icon={List}
                title="Belum ada watchlist"
                description="Tambahkan kategori atau bahan yang ingin dipantau secara khusus."
                action={
                  <Button size="sm" variant="outline" onClick={openCreateDialog}>
                    <Plus className="size-3.5" aria-hidden />
                    Tambah Watchlist
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.watchlists.map((w) => (
                  <div
                    key={w.id}
                    className={cn(hub.panel, hub.cardHover, "flex flex-col gap-3")}
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{w.name}</p>
                      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                        {w.keywords.join(", ")}
                      </p>
                    </div>
                    {w.latestDigest ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <ResearchHubStatChip
                          label="Digest"
                          value={TREND_RADAR_STATUS_LABELS[w.latestDigest.status]}
                          tone={statusChipTone(w.latestDigest.status)}
                        />
                        {w.latestDigest.generatedAt ? (
                          <span className="text-muted-foreground text-[10px]">
                            {formatRelativeTime(new Date(w.latestDigest.generatedAt))}
                          </span>
                        ) : null}
                        {w.latestDigest.status === "READY" ? (
                          <Button
                            size="sm"
                            variant="link"
                            className="h-auto p-0 text-xs"
                            render={
                              <Link
                                href={`/research-hub/trend-radar/${w.latestDigest.id}`}
                              />
                            }
                          >
                            Buka digest
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        Belum ada digest — klik refresh untuk generate.
                      </p>
                    )}
                    <div className="flex gap-1 border-t border-border/40 pt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRefreshWatchlist(w.id)}
                        disabled={pending}
                      >
                        <RefreshCw className="size-3.5" aria-hidden />
                        Generate
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(w)}
                        disabled={pending}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteWatchlist(w.id)}
                        disabled={pending}
                        className="text-rose-600 hover:text-rose-700 dark:text-rose-400"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Hapus
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ResearchHubSection>
        </TabsContent>

        <TabsContent value="archive" className={tabContentClass}>
          <ResearchHubSection title="Trend Archive" delayMs={160}>
            <div className={hub.panel}>
              <TrendArchiveTable digests={data.digests} />
            </div>
          </ResearchHubSection>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-border/60 border-b px-6 py-4">
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          <div className="max-h-[min(70vh,640px)] overflow-y-auto px-6 py-4">
            {dialogMode === "global" ? (
              <TrendSourceConfigPicker
                config={sourceConfig}
                onChange={setSourceConfig}
                tiktokConfigured={data.tiktokConfigured}
              />
            ) : (
              <div className="grid gap-4 py-1">
                <div className="grid gap-1.5">
                  <Label htmlFor="wl-name">Nama watchlist</Label>
                  <Input
                    id="wl-name"
                    placeholder="Ceramide & Barrier"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="wl-kw">Seed keywords (pisahkan koma)</Label>
                  <Input
                    id="wl-kw"
                    placeholder="ceramide, barrier cream, skin barrier"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Sumber data</Label>
                  <TrendSourceConfigPicker
                    config={sourceConfig}
                    onChange={setSourceConfig}
                    tiktokConfigured={data.tiktokConfigured}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-border/60 bg-muted/15 border-t px-6 py-4">
            <Button variant="outline" onClick={closeDialog} disabled={pending}>
              Batal
            </Button>
            <Button
              onClick={
                dialogMode === "global" ? handleRefreshGlobal : handleSaveWatchlist
              }
              disabled={pending}
            >
              {dialogMode === "global"
                ? pending
                  ? "Generating…"
                  : "Generate Digest"
                : pending
                  ? "Menyimpan…"
                  : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
