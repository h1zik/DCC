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
import {
  hub,
  ResearchHubEmptyState,
  ResearchHubSection,
  ResearchHubStatChip,
} from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";

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

  const totalSkus = competitors.reduce((sum, c) => sum + c.skuCount, 0);
  const totalAlerts = competitors.reduce((sum, c) => sum + c.unreadAlerts, 0);
  const activeCount = competitors.filter((c) => c.isActive).length;

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <ResearchHubStatChip
            label="Kompetitor"
            value={competitors.length.toLocaleString("id-ID")}
            tone="primary"
          />
          <ResearchHubStatChip
            label="Aktif"
            value={activeCount.toLocaleString("id-ID")}
            tone="success"
          />
          <ResearchHubStatChip
            label="Total SKU"
            value={totalSkus.toLocaleString("id-ID")}
          />
          <ResearchHubStatChip
            label="Alert"
            value={totalAlerts.toLocaleString("id-ID")}
            tone={totalAlerts > 0 ? "warning" : "neutral"}
          />
        </div>

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

      <ResearchHubSection
        title="Kompetitor dipantau"
        description="Pantau harga, SKU baru, rating, dan promo kompetitor."
      >
        {competitors.length === 0 ? (
          <ResearchHubEmptyState
            icon={Target}
            title="Belum ada kompetitor"
            description="Tambahkan brand kompetitor untuk pantau harga, SKU, dan promo."
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="size-3.5" aria-hidden />
                Tambah Kompetitor
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {competitors.map((c, index) => (
              <article
                key={c.id}
                className={cn(hub.panel, hub.cardHover, hub.entrance, "relative")}
                style={
                  index > 0 && index < 9
                    ? { animationDelay: `${index * 40}ms` }
                    : undefined
                }
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
                </Link>

                <div className="mt-3 flex flex-wrap gap-2">
                  <ResearchHubStatChip
                    label="SKU"
                    value={c.skuCount.toLocaleString("id-ID")}
                    tone="primary"
                  />
                  <ResearchHubStatChip
                    label="Rating"
                    value={c.avgRating != null ? c.avgRating.toFixed(1) : "—"}
                  />
                </div>

                {!c.isActive ? (
                  <span className="text-muted-foreground mt-2 block text-[10px] uppercase">
                    Nonaktif
                  </span>
                ) : null}

                <div className="mt-3 flex gap-1 border-t border-border/40 pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          await refreshResearchCompetitor(c.id);
                          toast.success("Refresh dimulai.");
                          router.refresh();
                        } catch (err) {
                          toast.error(
                            actionErrorMessage(err, "Gagal memproses permintaan."),
                          );
                        }
                      })
                    }
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                    Refresh
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        if (!confirm("Hapus kompetitor ini?")) return;
                        try {
                          await deleteResearchCompetitor(c.id);
                          toast.success("Kompetitor dihapus.");
                          router.refresh();
                        } catch (err) {
                          toast.error(
                            actionErrorMessage(err, "Gagal memproses permintaan."),
                          );
                        }
                      })
                    }
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Hapus
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </ResearchHubSection>
    </div>
  );
}
