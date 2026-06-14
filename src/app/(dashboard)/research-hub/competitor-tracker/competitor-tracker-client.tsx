"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ResearchMarketplace } from "@prisma/client";
import { Bell, Plus, RefreshCw, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createResearchCompetitor,
  deleteResearchCompetitor,
  refreshResearchCompetitor,
} from "@/actions/research-competitor";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { MARKETPLACE_LABELS } from "@/lib/research/labels";

export type CompetitorCard = {
  id: string;
  name: string;
  brand: string;
  category: string;
  marketplace: ResearchMarketplace;
  shopUrl: string;
  isActive: boolean;
  skuCount: number;
  avgRating: number | null;
  unreadAlerts: number;
};

export function CompetitorTrackerClient({
  competitors,
}: {
  competitors: CompetitorCard[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [marketplace, setMarketplace] = useState<ResearchMarketplace>(
    ResearchMarketplace.SHOPEE,
  );
  const [shopUrl, setShopUrl] = useState("");

  function handleCreate() {
    startTransition(async () => {
      try {
        const result = await createResearchCompetitor({
          name,
          brand,
          category,
          marketplace,
          shopUrl,
        });
        toast.success("Kompetitor ditambahkan — data SKU sudah diambil.");
        setDialogOpen(false);
        setName("");
        setBrand("");
        setCategory("");
        setShopUrl("");
        router.push(`/research-hub/competitor-tracker/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {competitors.length} kompetitor dipantau
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="size-3.5" aria-hidden />
                Tambah Kompetitor
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah ke Tracker</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-1.5">
                <Label>Nama toko / brand</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Brand</Label>
                <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Kategori</Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Bodycare"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Marketplace</Label>
                <Select
                  value={marketplace}
                  onValueChange={(v) => {
                    if (v) setMarketplace(v as ResearchMarketplace);
                  }}
                >
                  <SelectTrigger>
                    {MARKETPLACE_LABELS[marketplace]}
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MARKETPLACE_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>URL toko</Label>
                <Input
                  value={shopUrl}
                  onChange={(e) => setShopUrl(e.target.value)}
                  placeholder="https://shopee.co.id/nama-toko (bukan URL produk)"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={
                  pending ||
                  !name.trim() ||
                  !brand.trim() ||
                  !category.trim() ||
                  !shopUrl.trim()
                }
              >
                {pending ? "Menunggu Apify…" : "Simpan & Scrape"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {competitors.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed px-6 py-12 text-center">
          <Target className="mx-auto mb-3 size-8 opacity-40" aria-hidden />
          <p className="text-sm font-medium">Belum ada kompetitor</p>
          <p className="mt-1 text-xs">
            Tambahkan brand kompetitor untuk pantau harga, SKU, dan promo.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {competitors.map((c) => (
            <article
              key={c.id}
              className="border-border bg-card relative rounded-xl border p-4 shadow-sm"
            >
              {c.unreadAlerts > 0 ? (
                <span className="bg-primary text-primary-foreground absolute top-3 right-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                  <Bell className="size-3" aria-hidden />
                  {c.unreadAlerts}
                </span>
              ) : null}
              <Link
                href={`/research-hub/competitor-tracker/${c.id}`}
                className="block"
              >
                <p className="text-foreground pr-16 font-semibold">{c.name}</p>
                <p className="text-muted-foreground text-xs">{c.brand}</p>
                <p className="text-muted-foreground mt-2 text-xs">
                  {MARKETPLACE_LABELS[c.marketplace]} · {c.category}
                </p>
                <div className="mt-3 flex gap-4 text-sm">
                  <span>
                    <span className="text-muted-foreground text-xs">SKU </span>
                    <span className="font-medium tabular-nums">{c.skuCount}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground text-xs">Rating </span>
                    <span className="font-medium tabular-nums">
                      {c.avgRating != null ? c.avgRating.toFixed(1) : "—"}
                    </span>
                  </span>
                </div>
              </Link>
              <div className="mt-3 flex justify-end gap-1 border-t pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        await refreshResearchCompetitor(c.id);
                        toast.success("Refresh dimulai.");
                        router.refresh();
                      } catch (err) {
                        toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
                      }
                    })
                  }
                  title="Refresh"
                >
                  <RefreshCw className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      if (!confirm("Hapus kompetitor ini?")) return;
                      try {
                        await deleteResearchCompetitor(c.id);
                        toast.success("Kompetitor dihapus.");
                        router.refresh();
                      } catch (err) {
                        toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
                      }
                    })
                  }
                  title="Hapus"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              {!c.isActive ? (
                <span className="text-muted-foreground mt-2 block text-[10px] uppercase">
                  Nonaktif
                </span>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
