"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { TrendPhase, TrendRadarStatus } from "@prisma/client";
import { Archive, ExternalLink, List, Plus, Radar, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  createTrendWatchlist,
  deleteTrendWatchlist,
  refreshGlobalTrendDigest,
  refreshTrendWatchlist,
  updateTrendWatchlist,
} from "@/actions/research-trend-radar";
import { actionErrorMessage } from "@/lib/action-error-message";
import { validateTrendConfigClient } from "@/components/research-hub/trend-source-config-picker";
import { TrendQualityBanner } from "@/components/research-hub/trend-quality-banner";
import { TrendSignalStatsChips } from "@/components/research-hub/trend-signal-stats-line";
import { TrendPhaseBoard } from "@/components/research-hub/trend-phase-board";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatRelativeTime } from "@/lib/research/labels";
import type { TrendDigestMode } from "@prisma/client";
import type { TrendSignalStats } from "@/lib/research/trend-radar/trend-signal-types";
import type { TrendSourceConfig } from "@/lib/research/trend-radar/trend-source-config-types";
import { lab, LabEmptyState } from "@/components/lab/lab-primitives";
import { RunLedger, countRunTones } from "@/components/research-hub/kit/run-ledger";
import { cn } from "@/lib/utils";
import { TrendConfigDialog, type TrendDialogMode } from "./trend-config-dialog";
import { TrendDigestArchive } from "./trend-digest-archive";
import { trendToneOf } from "./trend-status";
import { TrendWatchlistTable } from "./trend-watchlist-table";

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

type Watchlist = TrendRadarPageData["watchlists"][number];

const LEDGER_LABELS = { running: "Sedang dibuat" } as const;

const tabContentClass =
  "animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-6 pt-6 duration-200 motion-reduce:animate-none";

export function TrendRadarClient({ data }: { data: TrendRadarPageData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogMode, setDialogMode] = useState<TrendDialogMode | null>(null);
  const [editWatchlistId, setEditWatchlistId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [sourceConfig, setSourceConfig] = useState<TrendSourceConfig>(
    data.globalSourceConfig,
  );
  const [deleteTarget, setDeleteTarget] = useState<Watchlist | null>(null);

  const globalJobStatus = data.globalInProgress?.status;
  const runningWatchlist = data.watchlists.find(
    (w) =>
      w.latestDigest?.status === "COLLECTING" ||
      w.latestDigest?.status === "ANALYZING",
  );
  const globalRunning =
    globalJobStatus === "COLLECTING" || globalJobStatus === "ANALYZING";
  const hasInProgress = globalRunning || runningWatchlist != null;

  const progressNote = globalRunning
    ? `Digest global sedang ${globalJobStatus === "COLLECTING" ? "mengumpulkan sinyal" : "menganalisis tren"}.`
    : runningWatchlist
      ? `Digest watchlist "${runningWatchlist.name}" sedang ${runningWatchlist.latestDigest?.status === "COLLECTING" ? "mengumpulkan sinyal" : "menganalisis tren"}.`
      : null;

  useEffect(() => {
    if (!hasInProgress) return;
    const id = window.setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 15_000);
    return () => window.clearInterval(id);
  }, [hasInProgress, router]);

  const counts = useMemo(
    () => countRunTones(data.digests, (d) => trendToneOf(d.status)),
    [data.digests],
  );
  const trendCount = data.latestGlobal?.items.length ?? 0;
  const activeWatchlists = data.watchlists.filter((w) => w.isActive).length;

  function openCreateDialog() {
    setDialogMode("create");
    setEditWatchlistId(null);
    setName("");
    setKeywords("");
    setSourceConfig(data.globalSourceConfig);
  }

  function openEditDialog(watchlist: Watchlist) {
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
        toast.success("Digest global mulai dibuat.");
        closeDialog();
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Digest global gagal dimulai. Periksa sumber data lalu coba lagi."));
      }
    });
  }

  function handleSaveWatchlist() {
    const kw = keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (!name.trim() || kw.length === 0) {
      toast.error("Isi nama watchlist dan minimal satu keyword.");
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
          toast.success(`Watchlist "${name.trim()}" disimpan.`);
        } else {
          await createTrendWatchlist({
            name: name.trim(),
            keywords: kw,
            sourceConfig,
          });
          toast.success(`Watchlist "${name.trim()}" dibuat.`);
        }
        closeDialog();
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Watchlist gagal disimpan."));
      }
    });
  }

  function handleRefreshWatchlist(wl: Watchlist) {
    const cfg = wl.sourceConfig ?? data.globalSourceConfig;
    const err = validateTrendConfigClient(cfg);
    if (err) {
      toast.error(err);
      openEditDialog(wl);
      return;
    }
    startTransition(async () => {
      try {
        await refreshTrendWatchlist(wl.id);
        toast.success(`Digest "${wl.name}" mulai dibuat.`);
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Digest watchlist gagal dimulai."));
      }
    });
  }

  function handleDeleteWatchlist() {
    const target = deleteTarget;
    if (!target) return;
    startTransition(async () => {
      try {
        await deleteTrendWatchlist(target.id);
        toast.success(`Watchlist "${target.name}" dihapus.`);
        setDeleteTarget(null);
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Watchlist gagal dihapus."));
      }
    });
  }

  const latest = data.latestGlobal;

  return (
    <div className="flex flex-col gap-6">
      {data.digests.length > 0 ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
          <RunLedger
            className="flex-1"
            counts={counts}
            noun="digest di arsip"
            labels={LEDGER_LABELS}
            detail={`${trendCount} tren di digest global terakhir, ${activeWatchlists} dari ${data.watchlists.length} watchlist aktif`}
          />
          <Button onClick={openGlobalDialog} disabled={pending || globalRunning}>
            <RefreshCw aria-hidden />
            Generate digest global
          </Button>
        </div>
      ) : null}

      {progressNote ? (
        <p className="rh-meta" aria-live="polite">
          {progressNote} Halaman ini diperbarui otomatis setelah digest selesai.
        </p>
      ) : null}

      <Tabs defaultValue="global" className="gap-0">
        <div className={cn(lab.stickyToolbar, "pb-0")}>
          <TabsList variant="line" className="h-9 w-full justify-start gap-4">
            <TabsTrigger value="global" className="px-1">
              <Radar className="size-3.5" aria-hidden />
              Digest global
            </TabsTrigger>
            <TabsTrigger value="watchlist" className="px-1">
              <List className="size-3.5" aria-hidden />
              Watchlist
              {data.watchlists.length > 0 ? (
                <span className="rh-num text-muted-foreground ml-1 text-xs">
                  {data.watchlists.length}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="archive" className="px-1">
              <Archive className="size-3.5" aria-hidden />
              Arsip
              {data.digests.length > 0 ? (
                <span className="rh-num text-muted-foreground ml-1 text-xs">
                  {data.digests.length}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="global" className={tabContentClass}>
          {latest ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-0.5">
                  <h2 className="rh-section-title">Digest global terbaru</h2>
                  {latest.generatedAt ? (
                    <p className="rh-meta">
                      Dibuat{" "}
                      <time dateTime={latest.generatedAt}>
                        {formatRelativeTime(new Date(latest.generatedAt))}
                      </time>
                      .
                    </p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href={`/research-hub/trend-radar/${latest.id}`} />}
                >
                  <ExternalLink aria-hidden />
                  Buka digest
                </Button>
              </div>
              <TrendQualityBanner
                digestMode={latest.digestMode}
                dataNotice={latest.dataNotice}
              />
              {latest.signalStats ? (
                <TrendSignalStatsChips stats={latest.signalStats} />
              ) : null}
              {latest.narrative ? (
                <p className="text-foreground/90 max-w-[72ch] text-sm leading-relaxed">
                  {latest.narrative}
                </p>
              ) : null}
              <TrendPhaseBoard digestId={latest.id} items={latest.items} />
            </>
          ) : (
            <LabEmptyState
              icon={Radar}
              title="Belum ada digest global"
              description="Digest global merangkum tren bahan, klaim, dan kategori minggu ini dari sinyal marketplace dan media sosial."
              action={
                <Button size="sm" onClick={openGlobalDialog} disabled={pending || globalRunning}>
                  <RefreshCw className="size-3.5" aria-hidden />
                  Generate digest global
                </Button>
              }
            />
          )}
        </TabsContent>

        <TabsContent value="watchlist" className={tabContentClass}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-0.5">
              <h2 className="rh-section-title">Watchlist</h2>
              <p className="rh-meta">
                Digest khusus untuk bahan, klaim, atau kategori yang ingin dipantau.
              </p>
            </div>
            {data.watchlists.length > 0 ? (
              <Button size="sm" variant="outline" onClick={openCreateDialog}>
                <Plus aria-hidden />
                Watchlist baru
              </Button>
            ) : null}
          </div>
          {data.watchlists.length === 0 ? (
            <LabEmptyState
              icon={List}
              title="Belum ada watchlist"
              description="Buat watchlist dari beberapa seed keyword, mis. ceramide atau skin barrier, untuk mendapat digest tren sendiri."
              action={
                <Button size="sm" onClick={openCreateDialog}>
                  <Plus className="size-3.5" aria-hidden />
                  Watchlist baru
                </Button>
              }
            />
          ) : (
            <TrendWatchlistTable
              watchlists={data.watchlists}
              pending={pending}
              onGenerate={handleRefreshWatchlist}
              onEdit={openEditDialog}
              onDelete={setDeleteTarget}
            />
          )}
        </TabsContent>

        <TabsContent value="archive" className={tabContentClass}>
          <div className="space-y-0.5">
            <h2 className="rh-section-title">Arsip digest</h2>
            <p className="rh-meta">20 digest terakhir, global maupun watchlist.</p>
          </div>
          {data.digests.length === 0 ? (
            <LabEmptyState
              icon={Archive}
              title="Arsip masih kosong"
              description="Setiap digest global dan watchlist yang dibuat tersimpan di sini."
            />
          ) : (
            <TrendDigestArchive
              digests={data.digests}
              counts={counts}
              statusLabels={LEDGER_LABELS}
            />
          )}
        </TabsContent>
      </Tabs>

      <TrendConfigDialog
        mode={dialogMode}
        onClose={closeDialog}
        name={name}
        onNameChange={setName}
        keywords={keywords}
        onKeywordsChange={setKeywords}
        sourceConfig={sourceConfig}
        onSourceConfigChange={setSourceConfig}
        tiktokConfigured={data.tiktokConfigured}
        pending={pending}
        onSubmit={dialogMode === "global" ? handleRefreshGlobal : handleSaveWatchlist}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Hapus watchlist "${deleteTarget?.name ?? ""}"?`}
        description="Keyword dan pengaturan sumber watchlist ini hilang, dan digest barunya berhenti dibuat. Digest lama tetap ada di arsip. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Hapus watchlist"
        pending={pending}
        onConfirm={handleDeleteWatchlist}
      />
    </div>
  );
}
