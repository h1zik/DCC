"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ResearchMarketplace } from "@prisma/client";
import {
  ArrowUpRight,
  Loader2,
  Plus,
  RefreshCw,
  Store,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  createResearchCompetitor,
  deleteResearchCompetitor,
  refreshResearchCompetitor,
} from "@/actions/research-competitor";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { MARKETPLACE_LABELS } from "@/lib/research/labels";
import type { SelectItemDef } from "@/lib/select-option-items";
import { lab, LabEmptyState } from "@/components/lab/lab-primitives";
import { CompetitorTrackerModeNav } from "@/components/research-hub/competitor-tracker-mode-nav";
import { cn } from "@/lib/utils";

const MARKETPLACE_ITEMS: SelectItemDef[] = Object.entries(MARKETPLACE_LABELS)
  .filter(([k]) => k !== ResearchMarketplace.LAZADA)
  .map(([value, label]) => ({ value, label }));

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

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        active
          ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          active ? "bg-emerald-500" : "bg-muted-foreground/50",
        )}
      />
      {active ? "Aktif" : "Nonaktif"}
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

export function CompetitorTrackerClient({
  competitors,
}: {
  competitors: CompetitorCard[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(competitors.length === 0);
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
  const ratings = competitors
    .map((c) => c.avgRating)
    .filter((r): r is number => r != null);
  const avgRating =
    ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : null;

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
        setFormOpen(false);
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
      <CompetitorTrackerModeNav />

      {/* Strip ringkasan portofolio */}
      {competitors.length > 0 ? (
        <div className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}>
          <div className="bento-tile border-transparent bg-violet-600 shadow-md shadow-violet-600/20 dark:bg-violet-500">
            <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
              Kompetitor dipantau
            </span>
            <span className="bento-value text-white dark:text-violet-950">
              {competitors.length.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium text-violet-100/90 dark:text-violet-900/80">
              {activeCount} aktif · update otomatis harian
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Total SKU</span>
            <span className="bento-value">{totalSkus.toLocaleString("id-ID")}</span>
            <span className="text-muted-foreground text-[11px] font-medium">
              dari seluruh toko kompetitor
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
            <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
              Rating rata-rata
            </span>
            <span className="bento-value text-violet-900 dark:text-violet-300">
              {avgRating != null ? avgRating.toFixed(1) : "—"}
            </span>
            <span className="text-[11px] font-medium text-violet-700/60 dark:text-violet-300/60">
              rerata seluruh toko
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
            <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
              Alert belum dibaca
            </span>
            <span className="bento-value text-amber-900 dark:text-amber-300">
              {totalAlerts.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium text-amber-800/60 dark:text-amber-300/60">
              harga, SKU baru, dan promo
            </span>
          </div>
        </div>
      ) : null}

      {/* Header daftar + toggle form */}
      <section className={cn(lab.section, lab.entrance)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={lab.sectionTitle}>Kompetitor dipantau</h2>
            <p className={lab.sectionDesc}>
              {competitors.length === 0
                ? "Tambahkan toko kompetitor pertama Anda di bawah."
                : `${competitors.length} toko · ${totalSkus.toLocaleString("id-ID")} SKU dipantau harga, rating, dan promonya.`}
            </p>
          </div>
          {competitors.length > 0 ? (
            <Button
              variant={formOpen ? "outline" : "default"}
              onClick={() => setFormOpen((v) => !v)}
            >
              {formOpen ? <X /> : <Plus />}
              {formOpen ? "Tutup" : "Tambah Kompetitor"}
            </Button>
          ) : null}
        </div>

        {/* Form tambah kompetitor (collapsible) */}
        {formOpen ? (
          <div
            className={cn(
              lab.panel,
              "grid gap-4",
              "animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none",
            )}
          >
            <div>
              <p className="text-foreground font-bold tracking-tight">
                Tambah ke tracker
              </p>
              <p className="text-muted-foreground text-sm">
                Masukkan URL toko kompetitor — seluruh katalognya di-scrape dan
                dipantau otomatis.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Nama toko / brand</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="mis. Kompetitor Official Shop"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Brand</Label>
                <Input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Kategori</Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Bodycare"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Marketplace</Label>
                <Select
                  value={marketplace}
                  items={MARKETPLACE_ITEMS}
                  onValueChange={(v) => {
                    if (v) setMarketplace(v as ResearchMarketplace);
                  }}
                >
                  <SelectTrigger>{MARKETPLACE_LABELS[marketplace]}</SelectTrigger>
                  <SelectContent>
                    {MARKETPLACE_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>URL toko</Label>
              <Input
                value={shopUrl}
                onChange={(e) => setShopUrl(e.target.value)}
                placeholder="https://shopee.co.id/nama-toko (bukan URL produk)"
                disabled={pending}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">
                Scrape awal mengambil ±100 SKU teratas sesuai urutan listing
                marketplace.
              </p>
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
                {pending ? <Loader2 className="animate-spin" /> : <Plus />}
                {pending ? "Menunggu Apify…" : "Simpan & Scrape"}
              </Button>
            </div>
          </div>
        ) : null}

        {/* Kartu kompetitor */}
        {competitors.length === 0 && !formOpen ? null : competitors.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {competitors.map((c) => (
              <div key={c.id} className={cn(lab.card, "group flex flex-col p-0")}>
                <Link
                  href={`/research-hub/competitor-tracker/${c.id}`}
                  className="flex flex-1 flex-col gap-4 p-5 pb-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-extrabold uppercase"
                        aria-hidden
                      >
                        {c.name.trim().charAt(0) || "?"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                          <span className="truncate">{c.name}</span>
                          <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {c.brand} · {c.category}
                        </p>
                      </div>
                    </div>
                    <StatusDot active={c.isActive} />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <CardStat
                      label="SKU"
                      value={c.skuCount.toLocaleString("id-ID")}
                    />
                    <CardStat
                      label="Rating"
                      value={c.avgRating != null ? c.avgRating.toFixed(1) : "—"}
                    />
                    <CardStat
                      label="Alert"
                      value={
                        c.unreadAlerts > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            {c.unreadAlerts.toLocaleString("id-ID")}
                          </span>
                        ) : (
                          "0"
                        )
                      }
                    />
                  </div>
                </Link>

                <div className="border-border/60 flex items-center justify-between gap-2 border-t px-3 py-2">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                    <Store className="size-3.5" aria-hidden />
                    {MARKETPLACE_LABELS[c.marketplace]}
                  </span>
                  <div className="flex items-center gap-1">
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
                      size="icon-sm"
                      disabled={pending}
                      aria-label="Hapus kompetitor"
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
                      <Trash2 className="text-destructive" aria-hidden />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <LabEmptyState
            icon={Target}
            title="Belum ada kompetitor"
            description="Tambahkan brand kompetitor untuk pantau harga, SKU, dan promo."
            action={
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="size-3.5" aria-hidden />
                Tambah Kompetitor
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}
