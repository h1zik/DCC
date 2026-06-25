"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus } from "lucide-react";
import { toast } from "sonner";
import {
  addDiscoveryProductToCompetitorTracker,
} from "@/actions/research-product-discovery";
import {
  listCompetitorProductCategories,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

type CategoryOption = { id: string; name: string };

export function DiscoveryCompetitorTrackerDialog({
  productId,
  productName,
  defaultCategoryName,
  disabled,
  className,
}: {
  productId: string;
  productName: string;
  defaultCategoryName: string;
  disabled?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [useNewCategory, setUseNewCategory] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState(defaultCategoryName);

  useEffect(() => {
    if (!open) return;
    setNewCategoryName(defaultCategoryName);
    setLoadingCategories(true);
    listCompetitorProductCategories()
      .then((rows) => {
        setCategories(rows);
        if (rows.length > 0) {
          setCategoryId(rows[0]!.id);
          setUseNewCategory(false);
        } else {
          setUseNewCategory(true);
        }
      })
      .catch((err) => {
        toast.error(actionErrorMessage(err, "Gagal memuat kategori."));
      })
      .finally(() => setLoadingCategories(false));
  }, [open, defaultCategoryName]);

  function handleSubmit() {
    startTransition(async () => {
      try {
        const result = await addDiscoveryProductToCompetitorTracker({
          productId,
          categoryId: useNewCategory ? undefined : categoryId,
          newCategoryName: useNewCategory ? newCategoryName.trim() : undefined,
        });
        // Scraping berjalan di latar belakang — user tetap di halaman ini dan
        // bebas navigasi. Beri opsi "Lihat" untuk membuka tracker bila perlu.
        toast.success(
          "Produk ditambahkan ke Competitor Tracker. Scraping berjalan di latar belakang.",
          {
            action: {
              label: "Lihat",
              onClick: () =>
                router.push(
                  `/research-hub/competitor-tracker/products/${result.categoryId}/tracks/${result.trackId}`,
                ),
            },
          },
        );
        setOpen(false);
      } catch (err) {
        toast.error(
          actionErrorMessage(err, "Gagal menambah ke Competitor Tracker."),
        );
      }
    });
  }

  const canSubmit =
    !pending &&
    !loadingCategories &&
    (useNewCategory ? newCategoryName.trim().length > 0 : categoryId.length > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={className}
            disabled={disabled || pending}
            title="Add to Competitor Tracker"
          >
            <PackagePlus className="size-3.5" aria-hidden />
            <span className="truncate">Tracker</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah ke Competitor Tracker</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-muted-foreground line-clamp-2 text-xs">{productName}</p>

          <div className="space-y-2">
            <Label>Kategori</Label>
            {categories.length > 0 ? (
              <Select
                value={useNewCategory ? "__new__" : categoryId}
                onValueChange={(value) => {
                  if (value === "__new__") {
                    setUseNewCategory(true);
                  } else {
                    setUseNewCategory(false);
                    setCategoryId(value ?? "");
                  }
                }}
                disabled={loadingCategories || pending}
              >
                <SelectTrigger className="w-full">
                  {useNewCategory
                    ? "Buat kategori baru"
                    : categories.find((c) => c.id === categoryId)?.name ??
                      "Pilih kategori"}
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__new__">+ Buat kategori baru</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-muted-foreground text-xs">
                Belum ada kategori — buat kategori baru di bawah.
              </p>
            )}
          </div>

          {useNewCategory || categories.length === 0 ? (
            <div className="space-y-2">
              <Label htmlFor={`new-cat-${productId}`}>Nama kategori baru</Label>
              <Input
                id={`new-cat-${productId}`}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={defaultCategoryName}
                disabled={pending}
              />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Batal
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {pending ? "Menambahkan…" : "Tambahkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
