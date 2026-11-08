"use client";

import { TrendSourceConfigPicker } from "@/components/research-hub/trend-source-config-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TrendSourceConfig } from "@/lib/research/trend-radar/trend-source-config-types";

export type TrendDialogMode = "create" | "edit" | "global";

const COPY: Record<
  TrendDialogMode,
  { title: string; description: string; submit: string; pending: string }
> = {
  global: {
    title: "Generate digest global",
    description: "Pilih sumber sinyal untuk digest mingguan semua kategori.",
    submit: "Generate digest",
    pending: "Memulai…",
  },
  create: {
    title: "Watchlist baru",
    description: "Pantau bahan, klaim, atau kategori tertentu dengan digest sendiri.",
    submit: "Buat watchlist",
    pending: "Membuat…",
  },
  edit: {
    title: "Ubah watchlist",
    description: "Perubahan dipakai di digest berikutnya.",
    submit: "Simpan perubahan",
    pending: "Menyimpan…",
  },
};

/** Dialog sumber digest global / buat & ubah watchlist. State milik halaman. */
export function TrendConfigDialog({
  mode,
  onClose,
  name,
  onNameChange,
  keywords,
  onKeywordsChange,
  sourceConfig,
  onSourceConfigChange,
  tiktokConfigured,
  pending,
  onSubmit,
}: {
  mode: TrendDialogMode | null;
  onClose: () => void;
  name: string;
  onNameChange: (v: string) => void;
  keywords: string;
  onKeywordsChange: (v: string) => void;
  sourceConfig: TrendSourceConfig;
  onSourceConfigChange: (v: TrendSourceConfig) => void;
  tiktokConfigured: boolean;
  pending: boolean;
  onSubmit: () => void;
}) {
  const copy = COPY[mode ?? "create"];

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-border/60 border-b px-6 py-4">
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(70vh,640px)] overflow-y-auto px-6 py-4">
          {mode === "global" ? (
            <TrendSourceConfigPicker
              config={sourceConfig}
              onChange={onSourceConfigChange}
              tiktokConfigured={tiktokConfigured}
            />
          ) : (
            <div className="grid gap-4 py-1">
              <div className="grid gap-1.5">
                <Label htmlFor="wl-name">Nama watchlist</Label>
                <Input
                  id="wl-name"
                  placeholder="Mis. Ceramide dan barrier"
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="wl-kw">Seed keyword</Label>
                <Input
                  id="wl-kw"
                  placeholder="ceramide, barrier cream, skin barrier"
                  value={keywords}
                  aria-describedby="wl-kw-hint"
                  onChange={(e) => onKeywordsChange(e.target.value)}
                />
                <p id="wl-kw-hint" className="rh-meta">
                  Pisahkan dengan koma.
                </p>
              </div>
              <fieldset className="grid gap-1.5">
                <legend className="mb-1.5 text-sm font-medium">Sumber data</legend>
                <TrendSourceConfigPicker
                  config={sourceConfig}
                  onChange={onSourceConfigChange}
                  tiktokConfigured={tiktokConfigured}
                />
              </fieldset>
            </div>
          )}
        </div>

        <DialogFooter className="border-border/60 bg-muted/15 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Batal
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? copy.pending : copy.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
