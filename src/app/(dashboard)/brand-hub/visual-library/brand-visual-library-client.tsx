"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ImageIcon, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createBrandVisualCollection,
  deleteBrandVisualCollection,
  scrapeBrandVisualCollection,
} from "@/actions/brand-visual-research";
import { actionErrorMessage } from "@/lib/action-error-message";
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
import { Badge } from "@/components/ui/badge";
import { MoodboardGrid } from "@/components/brand-hub/moodboard-grid";

export type VisualLibraryData = {
  collections: {
    id: string;
    name: string;
    keywords: string[];
    status: string;
    assetCount: number;
    errorMessage: string | null;
    updatedAt: string;
  }[];
  assets: {
    id: string;
    source: string;
    imageUrl: string;
    thumbnailUrl: string | null;
    title: string | null;
    tags: string[];
    sourceUrl: string | null;
  }[];
  pinterestMaxPins: number;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu",
  COLLECTING: "Mengumpulkan",
  READY: "Siap",
  FAILED: "Gagal",
};

export function BrandVisualLibraryClient({ data }: { data: VisualLibraryData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [filter, setFilter] = useState<string>("ALL");

  const filteredAssets =
    filter === "ALL"
      ? data.assets
      : data.assets.filter((a) => a.source === filter);

  function handleCreate() {
    const kw = keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (!name.trim() || kw.length === 0) {
      toast.error("Nama dan keyword diperlukan.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createBrandVisualCollection({ name, keywords: kw });
        await scrapeBrandVisualCollection(result.id);
        toast.success("Koleksi dibuat — Pinterest scrape berjalan.");
        setOpen(false);
        setName("");
        setKeywords("");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat koleksi."));
      }
    });
  }

  function handleScrape(id: string) {
    startTransition(async () => {
      try {
        await scrapeBrandVisualCollection(id);
        toast.success("Scrape Pinterest dijalankan.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Scrape gagal."));
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Hapus koleksi ini?")) return;
    startTransition(async () => {
      try {
        await deleteBrandVisualCollection(id);
        toast.success("Koleksi dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {data.assets.length} visual assets · max {data.pinterestMaxPins} pin/keyword
        </p>
        <Button size="sm" onClick={() => setOpen(true)} disabled={pending}>
          <Plus className="size-3.5" aria-hidden />
          Koleksi Pinterest
        </Button>
      </div>

      {data.collections.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.collections.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {c.keywords.join(", ")}
                  </p>
                </div>
                <Badge variant={c.status === "READY" ? "default" : "secondary"}>
                  {STATUS_LABEL[c.status] ?? c.status}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs">{c.assetCount} gambar</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => handleScrape(c.id)}
                >
                  <RefreshCw className="size-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => handleDelete(c.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {["ALL", "PINTEREST", "COMPETITOR_LISTING", "SOCIAL", "MANUAL"].map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f === "ALL" ? "Semua" : f.replace("_", " ")}
          </Button>
        ))}
      </div>

      {filteredAssets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-12 text-center">
          <ImageIcon className="size-10 text-muted-foreground" />
          <p className="text-sm font-semibold">Belum ada visual reference</p>
          <p className="text-muted-foreground text-xs">
            Buat koleksi Pinterest atau harvest gambar dari Competitor Tracker.
          </p>
        </div>
      ) : (
        <MoodboardGrid
          assets={filteredAssets.map((a) => ({
            id: a.id,
            imageUrl: a.imageUrl,
            title: a.title,
          }))}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Koleksi Pinterest</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Nama koleksi</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Keywords (pisah koma)</Label>
              <Input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="bodycare aesthetic, minimalist packaging"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleCreate} disabled={pending}>Buat & Scrape</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
