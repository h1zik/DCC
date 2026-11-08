"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ResearchMarketplace } from "@prisma/client";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { addCompetitorProductTrack } from "@/actions/research-competitor-product";
import { actionErrorMessage } from "@/lib/action-error-message";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { MarketplaceBadge } from "@/components/research-hub/marketplace-logo";
import { MARKETPLACE_LABELS } from "@/lib/research/labels";
import type { SelectItemDef } from "@/lib/select-option-items";

const MARKETPLACE_ITEMS: SelectItemDef[] = Object.entries(MARKETPLACE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

/** Dialog tambah produk kompetitor ke kategori lewat URL produk. */
export function AddProductDialog({
  categoryId,
  open,
  onOpenChange,
}: {
  categoryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [productUrl, setProductUrl] = useState("");
  const [marketplace, setMarketplace] = useState<ResearchMarketplace>(
    ResearchMarketplace.SHOPEE,
  );

  function handleAdd() {
    if (!productUrl.trim()) return;
    startTransition(async () => {
      try {
        const result = await addCompetitorProductTrack({
          categoryId,
          productUrl,
          marketplace,
        });
        toast.success("Produk ditambahkan.");
        onOpenChange(false);
        setProductUrl("");
        router.push(
          `/research-hub/competitor-tracker/products/${categoryId}/tracks/${result.id}`,
        );
      } catch (err) {
        toast.error(
          actionErrorMessage(
            err,
            "Produk gagal ditambahkan. Pastikan URL adalah halaman produk di marketplace yang dipilih.",
          ),
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah produk lewat URL</DialogTitle>
          <DialogDescription>
            Nama, harga, dan metrik produk diisi otomatis dari data marketplace
            setelah ditarik.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ct-add-marketplace">Marketplace</Label>
            <Select
              value={marketplace}
              items={MARKETPLACE_ITEMS}
              onValueChange={(v) => {
                if (v) setMarketplace(v as ResearchMarketplace);
              }}
            >
              <SelectTrigger id="ct-add-marketplace" disabled={pending}>
                <MarketplaceBadge marketplace={marketplace} />
              </SelectTrigger>
              <SelectContent>
                {MARKETPLACE_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    <MarketplaceBadge marketplace={item.value} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ct-add-url">URL produk</Label>
            <Input
              id="ct-add-url"
              type="url"
              placeholder="https://shopee.co.id/product/..."
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              disabled={pending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Batal
          </Button>
          <Button onClick={handleAdd} disabled={pending || !productUrl.trim()}>
            {pending ? (
              <Loader2 className="motion-safe:animate-spin" aria-hidden />
            ) : (
              <Plus aria-hidden />
            )}
            {pending ? "Menarik data produk…" : "Tambah produk"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
