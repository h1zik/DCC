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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MARKETPLACE_LABELS,
  PRODUCT_DISCOVERY_STATUS_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
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

function statusTone(status: ProductDiscoveryStatus) {
  switch (status) {
    case "READY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "FAILED":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "SCRAPING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground";
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
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {queries.length} pencarian · limit {MIN_PRODUCT_LIMIT}–{MAX_PRODUCT_LIMIT}{" "}
          produk per query
        </p>
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

      {queries.length === 0 ? (
        <div className="border-border/70 flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <PackageSearch className="text-muted-foreground mb-3 size-10" />
          <p className="font-medium">Belum ada pencarian produk</p>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            Masukkan keyword seperti &quot;body serum&quot; untuk menarik puluhan
            produk dari berbagai brand di Shopee, Tokopedia, atau TikTok Shop.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead>Marketplace</TableHead>
                <TableHead>Limit</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dibuat</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {queries.map((q) => (
                <TableRow key={q.id}>
                  <TableCell>
                    <Link
                      href={`/research-hub/product-discovery/${q.id}`}
                      className="font-medium hover:underline"
                    >
                      {q.keyword}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {q.marketplaces
                      .map((mp) => MARKETPLACE_LABELS[mp])
                      .join(", ")}
                  </TableCell>
                  <TableCell>{q.productLimit}</TableCell>
                  <TableCell>{q.productCount}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        statusTone(q.status),
                      )}
                    >
                      {PRODUCT_DISCOVERY_STATUS_LABELS[q.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatRelativeTime(new Date(q.createdAt))}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
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
                        <RefreshCw className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive h-8 w-8 p-0"
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
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
