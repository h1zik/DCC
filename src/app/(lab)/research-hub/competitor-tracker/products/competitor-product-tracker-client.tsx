"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bell, FolderPlus, Package, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createCompetitorProductCategory,
  deleteCompetitorProductCategory,
  refreshCompetitorProductCategory,
} from "@/actions/research-competitor-product";
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
import { Textarea } from "@/components/ui/textarea";
import {
  lab,
  LabEmptyState,
  LabSection,
  LabStatChip,
} from "@/components/lab/lab-primitives";
import { CompetitorTrackerModeNav } from "@/components/research-hub/competitor-tracker-mode-nav";
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

export function CompetitorProductTrackerClient({
  categories,
}: {
  categories: CompetitorProductCategoryCard[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const totalProducts = categories.reduce((sum, c) => sum + c.productCount, 0);
  const totalAlerts = categories.reduce((sum, c) => sum + c.unreadAlerts, 0);

  function handleCreate() {
    startTransition(async () => {
      try {
        const result = await createCompetitorProductCategory({
          name,
          description: description || undefined,
        });
        toast.success("Kategori dibuat.");
        setDialogOpen(false);
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <LabStatChip
            label="Kategori"
            value={categories.length.toLocaleString("id-ID")}
            tone="accent"
          />
          <LabStatChip
            label="Produk"
            value={totalProducts.toLocaleString("id-ID")}
          />
          <LabStatChip
            label="Alert"
            value={totalAlerts.toLocaleString("id-ID")}
            tone={totalAlerts > 0 ? "warning" : "neutral"}
          />
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button size="sm" className="gap-1.5">
                <FolderPlus className="size-4" />
                Kategori Baru
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat Kategori Produk</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="cat-name">Nama kategori</Label>
                <Input
                  id="cat-name"
                  placeholder="Mis. Deodorant, Body Lotion"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cat-desc">Deskripsi (opsional)</Label>
                <Textarea
                  id="cat-desc"
                  placeholder="Catatan internal untuk tim riset"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={pending || !name.trim()}
              >
                Buat Kategori
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {categories.length === 0 ? (
        <LabEmptyState
          icon={Package}
          title="Belum ada kategori produk"
          description="Buat kategori (mis. Deodorant), lalu tambahkan URL produk kompetitor spesifik untuk dipantau harga & metriknya."
        />
      ) : (
        <LabSection title="Kategori" description="Kelompok produk kompetitor per kategori pasar.">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => (
              <div
                key={category.id}
                className={cn(
                  lab.panel,
                  "group flex flex-col gap-3 p-4 transition-colors hover:border-[color-mix(in_srgb,var(--lab-accent,var(--primary))_30%,var(--border))]",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/research-hub/competitor-tracker/products/${category.id}`}
                    className="min-w-0 flex-1"
                  >
                    <h3 className="font-semibold leading-snug group-hover:text-[var(--lab-accent,var(--primary))]">
                      {category.name}
                    </h3>
                    {category.description ? (
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                        {category.description}
                      </p>
                    ) : null}
                  </Link>
                  {category.unreadAlerts > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                      <Bell className="size-3" />
                      {category.unreadAlerts}
                    </span>
                  ) : null}
                </div>

                <p className="text-muted-foreground text-sm tabular-nums">
                  {category.productCount} produk dipantau
                </p>

                <div className="mt-auto flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
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
                    <RefreshCw className="size-3.5" />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive gap-1"
                    disabled={pending}
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
                    <Trash2 className="size-3.5" />
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </LabSection>
      )}
    </div>
  );
}
