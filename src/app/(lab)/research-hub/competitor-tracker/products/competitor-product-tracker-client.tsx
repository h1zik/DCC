"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowUpRight,
  FolderPlus,
  Loader2,
  Package,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  createCompetitorProductCategory,
  deleteCompetitorProductCategory,
  refreshCompetitorProductCategory,
} from "@/actions/research-competitor-product";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { lab, LabEmptyState } from "@/components/lab/lab-primitives";
import { CompetitorTrackerModeNav } from "@/components/research-hub/competitor-tracker-mode-nav";
import { formatRelativeTime } from "@/lib/research/labels";
import { cn } from "@/lib/utils";

export type CompetitorProductCategoryCard = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  productCount: number;
  unreadAlerts: number;
  updatedAt: string;
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

export function CompetitorProductTrackerClient({
  categories,
}: {
  categories: CompetitorProductCategoryCard[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(categories.length === 0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const totalProducts = categories.reduce((sum, c) => sum + c.productCount, 0);
  const totalAlerts = categories.reduce((sum, c) => sum + c.unreadAlerts, 0);
  const activeCount = categories.filter((c) => c.isActive).length;

  function handleCreate() {
    startTransition(async () => {
      try {
        const result = await createCompetitorProductCategory({
          name,
          description: description || undefined,
        });
        toast.success("Kategori dibuat.");
        setFormOpen(false);
        setName("");
        setDescription("");
        router.push(`/research-hub/competitor-tracker/products/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat kategori."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <CompetitorTrackerModeNav />

      {/* Strip ringkasan */}
      {categories.length > 0 ? (
        <div className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}>
          <div className="bento-tile border-transparent bg-violet-600 shadow-md shadow-violet-600/20 dark:bg-violet-500">
            <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
              Kategori produk
            </span>
            <span className="bento-value text-white dark:text-violet-950">
              {categories.length.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium text-violet-100/90 dark:text-violet-900/80">
              {activeCount} aktif dipantau
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Produk dipantau</span>
            <span className="bento-value">
              {totalProducts.toLocaleString("id-ID")}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              URL produk lintas marketplace
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
            <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
              Rata-rata per kategori
            </span>
            <span className="bento-value text-violet-900 dark:text-violet-300">
              {categories.length > 0
                ? Math.round(totalProducts / categories.length).toLocaleString(
                    "id-ID",
                  )
                : "—"}
            </span>
            <span className="text-[11px] font-medium text-violet-700/60 dark:text-violet-300/60">
              produk per kategori
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
              harga, rating, dan promo
            </span>
          </div>
        </div>
      ) : null}

      {/* Header daftar + toggle form */}
      <section className={cn(lab.section, lab.entrance)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={lab.sectionTitle}>Kategori</h2>
            <p className={lab.sectionDesc}>
              {categories.length === 0
                ? "Buat kategori pertama Anda di bawah — mis. Deodorant."
                : `${categories.length} kategori · ${totalProducts.toLocaleString("id-ID")} produk kompetitor dikelompokkan per pasar.`}
            </p>
          </div>
          {categories.length > 0 ? (
            <Button
              variant={formOpen ? "outline" : "default"}
              onClick={() => setFormOpen((v) => !v)}
            >
              {formOpen ? <X /> : <FolderPlus />}
              {formOpen ? "Tutup" : "Kategori Baru"}
            </Button>
          ) : null}
        </div>

        {/* Form kategori baru (collapsible) */}
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
                Buat kategori produk
              </p>
              <p className="text-muted-foreground text-sm">
                Kelompokkan produk kompetitor per kategori pasar, lalu tambahkan
                URL produk spesifik di dalamnya.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cat-name">Nama kategori</Label>
              <Input
                id="cat-name"
                placeholder="Mis. Deodorant, Body Lotion"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cat-desc">Deskripsi (opsional)</Label>
              <Textarea
                id="cat-desc"
                placeholder="Catatan internal untuk tim riset"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={pending}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleCreate} disabled={pending || !name.trim()}>
                {pending ? <Loader2 className="animate-spin" /> : <FolderPlus />}
                Buat Kategori
              </Button>
            </div>
          </div>
        ) : null}

        {/* Kartu kategori */}
        {categories.length === 0 && !formOpen ? null : categories.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => (
              <div
                key={category.id}
                className={cn(lab.card, "group flex flex-col p-0")}
              >
                <Link
                  href={`/research-hub/competitor-tracker/products/${category.id}`}
                  className="flex flex-1 flex-col gap-4 p-5 pb-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl"
                        aria-hidden
                      >
                        <Package className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                          <span className="truncate">{category.name}</span>
                          <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                        </p>
                        {category.description ? (
                          <p className="text-muted-foreground truncate text-xs">
                            {category.description}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <StatusDot active={category.isActive} />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <CardStat
                      label="Produk"
                      value={category.productCount.toLocaleString("id-ID")}
                    />
                    <CardStat
                      label="Alert"
                      value={
                        category.unreadAlerts > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            {category.unreadAlerts.toLocaleString("id-ID")}
                          </span>
                        ) : (
                          "0"
                        )
                      }
                    />
                    <CardStat
                      label="Update"
                      value={formatRelativeTime(new Date(category.updatedAt))}
                    />
                  </div>
                </Link>

                <div className="border-border/60 flex items-center justify-end gap-1 border-t px-3 py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          await refreshCompetitorProductCategory(category.id);
                          toast.success("Refresh kategori dijadwalkan.");
                          router.refresh();
                        } catch (err) {
                          toast.error(
                            actionErrorMessage(err, "Gagal refresh kategori."),
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
                    aria-label="Hapus kategori"
                    onClick={() =>
                      startTransition(async () => {
                        if (
                          !confirm(
                            `Hapus kategori "${category.name}" dan semua produknya?`,
                          )
                        ) {
                          return;
                        }
                        try {
                          await deleteCompetitorProductCategory(category.id);
                          toast.success("Kategori dihapus.");
                          router.refresh();
                        } catch (err) {
                          toast.error(
                            actionErrorMessage(err, "Gagal menghapus kategori."),
                          );
                        }
                      })
                    }
                  >
                    <Trash2 className="text-destructive" aria-hidden />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <LabEmptyState
            icon={Package}
            title="Belum ada kategori produk"
            description="Buat kategori (mis. Deodorant), lalu tambahkan URL produk kompetitor spesifik untuk dipantau harga & metriknya."
            action={
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <FolderPlus className="size-3.5" aria-hidden />
                Kategori Baru
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}
