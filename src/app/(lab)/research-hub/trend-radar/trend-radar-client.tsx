"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { TrendPhase, TrendRadarStatus } from "@prisma/client";
import {
  Archive,
  ArrowUpRight,
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
import { lab, LabEmptyState, LabSection } from "@/components/lab/lab-primitives";
import { cn } from "@/lib/utils";

export type TrendRadarPageData = {
  globalInProgress: {
    id: string;
    status: TrendRadarStatus;
  } | null;
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

function isRunningStatus(status: TrendRadarStatus | null | undefined) {
  return (
    status === "COLLECTING" || status === "ANALYZING" || status === "PENDING"
  );
}

/** Pill status digest gaya bento (emerald siap / amber berjalan / rose gagal). */
function DigestStatusPill({
  status,
}: {
  status: TrendRadarStatus | null | undefined;
}) {
  const tone =
    status === "READY"
      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
      : status === "FAILED"
        ? "bg-rose-500/12 text-rose-700 dark:text-rose-300"
        : isRunningStatus(status)
          ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
          : "bg-muted text-muted-foreground";
  const dot =
    status === "READY"
      ? "bg-emerald-500"
      : status === "FAILED"
        ? "bg-rose-500"
        : isRunningStatus(status)
          ? "bg-amber-500"
          : "bg-muted-foreground/50";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot)} />
      {status ? TREND_RADAR_STATUS_LABELS[status] : "Belum ada digest"}
    </span>
  );
}

function CardStat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
        {label}
      </p>
      <p className="text-foreground mt-0.5 truncate text-sm font-extrabold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
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

  const globalJobStatus = data.globalInProgress?.status;

  const hasInProgress =
    globalJobStatus === "COLLECTING" ||
    globalJobStatus === "ANALYZING" ||
    data.watchlists.some(
      (w) =>
        w.latestDigest?.status === "COLLECTING" ||
        w.latestDigest?.status === "ANALYZING",
    );

  const progressSubtitle = (() => {
    if (globalJobStatus === "COLLECTING") {
      return "Digest global — mengumpulkan sinyal";
    }
    if (globalJobStatus === "ANALYZING") {
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
  const activeWatchlists = data.watchlists.filter((w) => w.isActive).length;
  const hasAnyData = data.latestGlobal != null || data.digests.length > 0;

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
      {/* Strip ringkasan bento */}
      {hasAnyData ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          {/* Hero violet */}
          <div className="bento-tile border-transparent bg-violet-600 shadow-md shadow-violet-600/20 dark:bg-violet-500">
            <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
              Tren terdeteksi
            </span>
            <span className="bento-value text-white dark:text-violet-950">
              {trendCount}
            </span>
            <span className="text-[11px] font-medium leading-snug text-violet-100/90 dark:text-violet-900/80">
              {totalSignals != null
                ? `dari ${totalSignals.toLocaleString("id-ID")} sinyal digest global`
                : data.latestGlobal?.generatedAt
                  ? `digest global ${formatRelativeTime(new Date(data.latestGlobal.generatedAt))}`
                  : "jalankan digest global untuk mulai"}
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

          <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
            <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
              Watchlist
            </span>
            <span className="bento-value text-violet-900 dark:text-violet-300">
              {data.watchlists.length}
            </span>
            <span className="text-[11px] font-medium text-violet-700/60 dark:text-violet-300/50">
              {activeWatchlists} aktif dipantau
            </span>
          </div>
        </div>
      ) : null}

      {hasInProgress ? (
        <TrendDigestProgressStrip subtitle={progressSubtitle} />
      ) : null}

      <Tabs defaultValue="global" className="gap-0">
        <div className={cn(lab.stickyToolbar, "pb-0")}>
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
              {data.digests.length > 0 ? (
                <span className="text-muted-foreground ml-1 text-[10px] tabular-nums">
                  {data.digests.length}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="global" className={tabContentClass}>
          <LabSection
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
                      <Link
                        href={`/research-hub/trend-radar/${data.latestGlobal.id}`}
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
                  <TrendSignalStatsChips
                    stats={data.latestGlobal.signalStats}
                  />
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
                />
              </div>
            ) : (
              <LabEmptyState
                icon={Radar}
                title="Belum ada digest global"
                description="Klik Refresh Global untuk generate digest mingguan pertama."
                action={
                  <Button
                    size="sm"
                    onClick={openGlobalDialog}
                    disabled={pending}
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                    Refresh Global
                  </Button>
                }
              />
            )}
          </LabSection>
        </TabsContent>

        <TabsContent value="watchlist" className={tabContentClass}>
          <LabSection
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
              <LabEmptyState
                icon={List}
                title="Belum ada watchlist"
                description="Tambahkan kategori atau bahan yang ingin dipantau secara khusus."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openCreateDialog}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Tambah Watchlist
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.watchlists.map((w) => {
                  const digestReady = w.latestDigest?.status === "READY";
                  const mainContent = (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-extrabold uppercase"
                            aria-hidden
                          >
                            {w.name.trim().charAt(0) || "?"}
                          </span>
                          <div className="min-w-0">
                            <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                              <span className="truncate">{w.name}</span>
                              {digestReady ? (
                                <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                              ) : null}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {w.keywords.join(", ")}
                            </p>
                          </div>
                        </div>
                        <DigestStatusPill status={w.latestDigest?.status} />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <CardStat label="Keyword" value={w.keywords.length} />
                        <CardStat
                          label="Digest"
                          value={
                            w.latestDigest
                              ? TREND_RADAR_STATUS_LABELS[
                                  w.latestDigest.status
                                ]
                              : "—"
                          }
                        />
                        <CardStat
                          label="Update"
                          value={
                            w.latestDigest?.generatedAt
                              ? formatRelativeTime(
                                  new Date(w.latestDigest.generatedAt),
                                )
                              : "—"
                          }
                        />
                      </div>

                      {!w.latestDigest ? (
                        <p className="text-muted-foreground text-xs">
                          Belum ada digest — klik Generate untuk memulai.
                        </p>
                      ) : null}
                    </>
                  );

                  return (
                    <div
                      key={w.id}
                      className={cn(lab.card, "group flex flex-col p-0")}
                    >
                      {digestReady && w.latestDigest ? (
                        <Link
                          href={`/research-hub/trend-radar/${w.latestDigest.id}`}
                          className="flex flex-1 flex-col gap-4 p-5 pb-4"
                        >
                          {mainContent}
                        </Link>
                      ) : (
                        <div className="flex flex-1 flex-col gap-4 p-5 pb-4">
                          {mainContent}
                        </div>
                      )}

                      <div className="border-border/60 flex items-center justify-end gap-1 border-t px-3 py-2">
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
                          size="icon-sm"
                          onClick={() => handleDeleteWatchlist(w.id)}
                          disabled={pending}
                          aria-label="Hapus watchlist"
                        >
                          <Trash2 className="text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </LabSection>
        </TabsContent>

        <TabsContent value="archive" className={tabContentClass}>
          <LabSection title="Trend Archive" delayMs={160}>
            <div className={cn(lab.card, "p-0")}>
              <TrendArchiveTable digests={data.digests} />
            </div>
          </LabSection>
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
                dialogMode === "global"
                  ? handleRefreshGlobal
                  : handleSaveWatchlist
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
