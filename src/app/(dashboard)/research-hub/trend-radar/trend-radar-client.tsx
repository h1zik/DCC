"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { TrendPhase, TrendRadarStatus } from "@prisma/client";
import { Pencil, Plus, Radar, RefreshCw, Trash2 } from "lucide-react";
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

export type TrendRadarPageData = {
  latestGlobal: {
    id: string;
    narrative: string | null;
    generatedAt: string | null;
    status: TrendRadarStatus;
    items: {
      id: string;
      name: string;
      phase: TrendPhase;
      dimension: string;
      isGlobalPipeline: boolean;
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {data.latestGlobal?.generatedAt
            ? `Update global: ${formatRelativeTime(new Date(data.latestGlobal.generatedAt))}`
            : "Belum ada digest global"}
        </p>
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

      {data.latestGlobal ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Trend Radar — Digest Global</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {data.latestGlobal.narrative ? (
              <p className="text-muted-foreground text-sm leading-relaxed">
                {data.latestGlobal.narrative}
              </p>
            ) : null}
            <TrendPhaseBoard
              digestId={data.latestGlobal.id}
              items={data.latestGlobal.items}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="border-border/70 flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
          <Radar className="text-muted-foreground size-10" aria-hidden />
          <p className="text-muted-foreground text-sm">
            Belum ada digest global. Klik Refresh Global untuk generate.
          </p>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Watchlist</CardTitle>
          <Button size="sm" variant="outline" onClick={openCreateDialog}>
            <Plus className="size-3.5" aria-hidden />
            Tambah
          </Button>
        </CardHeader>
        <CardContent>
          {data.watchlists.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Belum ada watchlist. Tambahkan kategori/bahan yang ingin dipantau.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.watchlists.map((w) => (
                <li
                  key={w.id}
                  className="border-border/70 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{w.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {w.keywords.join(", ")}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRefreshWatchlist(w.id)}
                      disabled={pending}
                      title="Generate digest"
                    >
                      <RefreshCw className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEditDialog(w)}
                      disabled={pending}
                      title="Edit watchlist"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteWatchlist(w.id)}
                      disabled={pending}
                      title="Hapus"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Trend Archive</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendArchiveTable digests={data.digests} />
        </CardContent>
      </Card>

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
