"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ProductDiscoveryStatus,
  ResearchMarketplace,
} from "@prisma/client";
import { PackageSearch, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  MAX_PRODUCT_LIMIT,
  MIN_PRODUCT_LIMIT,
} from "@/lib/research/product-discovery/constants";
import {
  createProductDiscoveryQuery,
  deleteProductDiscoveryQuery,
  refreshProductDiscoveryQuery,
} from "@/actions/research-product-discovery";
import { actionErrorMessage } from "@/lib/action-error-message";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  MARKETPLACE_LABELS,
  PRODUCT_DISCOVERY_STATUS_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
import {
  hub,
  ResearchHubEmptyState,
  ResearchHubSection,
  ResearchHubStatChip,
} from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";
import { useProductDiscoveryPolling } from "./use-product-discovery-polling";

export type ProductDiscoveryQueryRow = {
  id: string;
  keyword: string;
  marketplaces: ResearchMarketplace[];
  productLimit: number;
  status: ProductDiscoveryStatus;
  productCount: number;
  errorMessage: string | null;
  createdAt: string;
};

const ALL_MARKETPLACES: ResearchMarketplace[] = [
  ResearchMarketplace.SHOPEE,
  ResearchMarketplace.TOKOPEDIA,
  ResearchMarketplace.TIKTOK_SHOP,
];

function statusChipTone(
  status: ProductDiscoveryStatus,
): "neutral" | "success" | "warning" | "primary" {
  switch (status) {
    case "READY":
      return "success";
    case "FAILED":
      return "warning";
    case "SCRAPING":
    case "PENDING":
      return "warning";
    default:
      return "neutral";
  }
}

export function ProductDiscoveryClient({
  queries,
}: {
  queries: ProductDiscoveryQueryRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [productLimit, setProductLimit] = useState(50);
  const [marketplaces, setMarketplaces] = useState<ResearchMarketplace[]>([
    ResearchMarketplace.SHOPEE,
  ]);

  const hasInProgress = queries.some((q) => q.status === "SCRAPING");
  const readyCount = queries.filter((q) => q.status === "READY").length;
  const totalProducts = queries.reduce((sum, q) => sum + q.productCount, 0);

  useProductDiscoveryPolling(hasInProgress);

  function toggleMarketplace(mp: ResearchMarketplace) {
    setMarketplaces((prev) =>
      prev.includes(mp) ? prev.filter((p) => p !== mp) : [...prev, mp],
    );
  }

  function handleCreate() {
    if (!keyword.trim()) {
      toast.error("Keyword wajib diisi.");
      return;
    }
    if (marketplaces.length === 0) {
      toast.error("Pilih minimal satu marketplace.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createProductDiscoveryQuery({
          keyword: keyword.trim(),
          marketplaces,
          productLimit,
        });
        toast.success("Pencarian produk dimulai.");
        setDialogOpen(false);
        setKeyword("");
        router.push(`/research-hub/product-discovery/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat pencarian."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <ResearchHubStatChip
            label="Pencarian"
            value={queries.length.toLocaleString("id-ID")}
            tone="primary"
          />
          <ResearchHubStatChip
            label="Siap"
            value={readyCount.toLocaleString("id-ID")}
            tone="success"
          />
          <ResearchHubStatChip
            label="Total produk"
            value={totalProducts.toLocaleString("id-ID")}
          />
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="mr-1.5 size-3.5" />
                Pencarian Baru
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cari Produk by Keyword</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="pd-keyword">Keyword</Label>
                <Input
                  id="pd-keyword"
                  placeholder='Mis. "body serum"'
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pd-limit">
                  Jumlah produk (max {MAX_PRODUCT_LIMIT})
                </Label>
                <Input
                  id="pd-limit"
                  type="number"
                  min={MIN_PRODUCT_LIMIT}
                  max={MAX_PRODUCT_LIMIT}
                  value={productLimit}
                  onChange={(e) =>
                    setProductLimit(
                      Math.min(
                        MAX_PRODUCT_LIMIT,
                        Math.max(
                          MIN_PRODUCT_LIMIT,
                          Number(e.target.value) || MIN_PRODUCT_LIMIT,
                        ),
                      ),
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Marketplace</Label>
                <div className="flex flex-wrap gap-3">
                  {ALL_MARKETPLACES.map((mp) => (
                    <label
                      key={mp}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={marketplaces.includes(mp)}
                        onCheckedChange={() => toggleMarketplace(mp)}
                      />
                      {MARKETPLACE_LABELS[mp]}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={pending}>
                {pending ? "Memulai..." : "Tarik Produk"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {hasInProgress ? (
        <div className={hub.entrance}>
          <JobProgressBar
            title="Scraping produk berjalan"
            percent={35}
            stepLabel="Satu atau lebih pencarian sedang menarik produk dari marketplace."
          />
          <p className="text-muted-foreground mt-1.5 px-1 text-xs">
            Halaman diperbarui otomatis setiap beberapa detik.
          </p>
        </div>
      ) : null}

      <ResearchHubSection
        title="Pencarian"
        description={`Limit ${MIN_PRODUCT_LIMIT}–${MAX_PRODUCT_LIMIT} produk per query`}
      >
        {queries.length === 0 ? (
          <ResearchHubEmptyState
            icon={PackageSearch}
            title="Belum ada pencarian produk"
            description='Masukkan keyword seperti "body serum" untuk menarik puluhan produk dari berbagai brand di Shopee, Tokopedia, atau TikTok Shop.'
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="size-3.5" aria-hidden />
                Pencarian Baru
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {queries.map((q, index) => (
              <div
                key={q.id}
                className={cn(hub.panel, hub.cardHover, hub.entrance)}
                style={
                  index > 0 && index < 8
                    ? { animationDelay: `${index * 40}ms` }
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/research-hub/product-discovery/${q.id}`}
                      className="hover:text-primary text-base font-semibold transition-colors duration-150 motion-reduce:transition-none"
                    >
                      &quot;{q.keyword}&quot;
                    </Link>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {q.marketplaces
                        .map((mp) => MARKETPLACE_LABELS[mp])
                        .join(", ")}{" "}
                      · limit {q.productLimit}
                    </p>
                  </div>
                  <ResearchHubStatChip
                    label="Status"
                    value={PRODUCT_DISCOVERY_STATUS_LABELS[q.status]}
                    tone={statusChipTone(q.status)}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <ResearchHubStatChip
                    label="Produk"
                    value={q.productCount.toLocaleString("id-ID")}
                    tone="primary"
                  />
                  <ResearchHubStatChip
                    label="Dibuat"
                    value={formatRelativeTime(new Date(q.createdAt))}
                  />
                </div>

                {q.errorMessage ? (
                  <p className="text-amber-700 dark:text-amber-300 mt-2 text-xs">
                    {q.errorMessage}
                  </p>
                ) : null}

                <div className="mt-3 flex gap-1 border-t border-border/40 pt-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending || q.status === "SCRAPING"}
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          await refreshProductDiscoveryQuery(q.id);
                          toast.success("Refresh dimulai.");
                          router.refresh();
                        } catch (err) {
                          toast.error(
                            actionErrorMessage(err, "Gagal refresh."),
                          );
                        }
                      })
                    }
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          await deleteProductDiscoveryQuery(q.id);
                          toast.success("Pencarian dihapus.");
                          router.refresh();
                        } catch (err) {
                          toast.error(
                            actionErrorMessage(err, "Gagal hapus."),
                          );
                        }
                      })
                    }
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ResearchHubSection>
    </div>
  );
}
