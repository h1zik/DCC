"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ResearchMarketplace } from "@prisma/client";
import { Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { createResearchCompetitor } from "@/actions/research-competitor";
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
import { lab } from "@/components/lab/lab-primitives";
import { MarketplaceBadge } from "@/components/research-hub/marketplace-logo";
import { cn } from "@/lib/utils";

const MARKETPLACE_ITEMS: SelectItemDef[] = Object.entries(MARKETPLACE_LABELS)
  .filter(([k]) => k !== ResearchMarketplace.LAZADA)
  .map(([value, label]) => ({ value, label }));

/** Form tambah toko kompetitor: simpan lalu scrape katalog awal. */
export function CompetitorShopForm({
  id,
  onCancel,
}: {
  id: string;
  /** Tidak diisi saat form adalah satu-satunya isi halaman (belum ada toko). */
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [marketplace, setMarketplace] = useState<ResearchMarketplace>(
    ResearchMarketplace.SHOPEE,
  );
  const [shopUrl, setShopUrl] = useState("");

  const canSubmit =
    name.trim() !== "" &&
    brand.trim() !== "" &&
    category.trim() !== "" &&
    shopUrl.trim() !== "";

  function handleCreate() {
    if (!canSubmit) return;
    startTransition(async () => {
      try {
        const result = await createResearchCompetitor({
          name,
          brand,
          category,
          marketplace,
          shopUrl,
        });
        toast.success(`"${name.trim()}" ditambahkan. Data SKU sudah ditarik.`);
        router.push(`/research-hub/competitor-tracker/${result.id}`);
      } catch (err) {
        toast.error(
          actionErrorMessage(
            err,
            "Toko gagal ditambahkan. Pastikan URL adalah halaman toko, bukan halaman produk.",
          ),
        );
      }
    });
  }

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        lab.panel,
        "grid gap-5",
        "animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none",
      )}
    >
      <div className="space-y-1">
        <h2 id={`${id}-title`} className="rh-section-title">
          Tambah toko kompetitor
        </h2>
        <p className="rh-lede">
          Masukkan URL toko kompetitor. Seluruh katalognya ditarik lalu harga,
          SKU baru, dan promonya dipantau otomatis setiap hari.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-name`}>Nama toko</Label>
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mis. Kompetitor Official Shop"
            disabled={pending}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-brand`}>Brand</Label>
          <Input
            id={`${id}-brand`}
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-category`}>Kategori</Label>
          <Input
            id={`${id}-category`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Mis. Bodycare"
            disabled={pending}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-marketplace`}>Marketplace</Label>
          <Select
            value={marketplace}
            items={MARKETPLACE_ITEMS}
            onValueChange={(v) => {
              if (v) setMarketplace(v as ResearchMarketplace);
            }}
          >
            <SelectTrigger id={`${id}-marketplace`} disabled={pending}>
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
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-url`}>URL toko</Label>
        <Input
          id={`${id}-url`}
          type="url"
          value={shopUrl}
          onChange={(e) => setShopUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
          placeholder="https://shopee.co.id/nama-toko"
          aria-describedby={`${id}-url-hint`}
          disabled={pending}
        />
        <p id={`${id}-url-hint`} className="rh-meta">
          Pakai URL halaman toko, bukan URL produk. Scrape awal mengambil
          sekitar 100 SKU teratas sesuai urutan listing marketplace.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {pending ? (
          <p className="rh-meta me-auto" aria-live="polite">
            Menarik katalog toko. Ini bisa makan waktu sampai satu menit.
          </p>
        ) : null}
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Batal
          </Button>
        ) : null}
        <Button onClick={handleCreate} disabled={pending || !canSubmit}>
          {pending ? (
            <Loader2 className="motion-safe:animate-spin" aria-hidden />
          ) : (
            <Store aria-hidden />
          )}
          {pending ? "Menarik katalog…" : "Tambah dan tarik SKU"}
        </Button>
      </div>
    </section>
  );
}
