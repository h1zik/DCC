"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ProductDiscoveryStatus,
  ResearchMarketplace,
} from "@prisma/client";
import { PackageSearch, Plus, RefreshCw, Trash2, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MARKETPLACE_LABELS,
  PRODUCT_DISCOVERY_STATUS_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
import { lab, LabEmptyState } from "@/components/lab/lab-primitives";
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
  ResearchMarketplace.LAZADA,
  ResearchMarketplace.TIKTOK_SHOP,
  ResearchMarketplace.FEMALEDAILY,
  ResearchMarketplace.SOCIOLLA,
];

function isInProgress(status: ProductDiscoveryStatus) {
  return status === "SCRAPING" || status === "PENDING";
}

/** Pill status bergaya bento: emerald siap, amber berjalan, rose gagal. */
function StatusPill({ status }: { status: ProductDiscoveryStatus }) {
  const tone =
    status === "READY"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : status === "FAILED"
        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
        : isInProgress(status)
          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
          : "bg-muted text-muted-foreground";
  const dot =
    status === "READY"
      ? "bg-emerald-500"
      : status === "FAILED"
        ? "bg-rose-500"
        : isInProgress(status)
          ? "bg-amber-500"
          : "bg-muted-foreground/50";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          dot,
          isInProgress(status) && "animate-pulse",
        )}
      />
      {PRODUCT_DISCOVERY_STATUS_LABELS[status]}
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

export function ProductDiscoveryClient({
  queries,
}: {
  queries: ProductDiscoveryQueryRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(queries.length === 0);
  const [keyword, setKeyword] = useState("");
  const [productLimit, setProductLimit] = useState(50);
  const [marketplaces, setMarketplaces] = useState<ResearchMarketplace[]>([
    ResearchMarketplace.SHOPEE,
  ]);

  const hasInProgress = queries.some((q) => q.status === "SCRAPING");
  const readyCount = queries.filter((q) => q.status === "READY").length;
  const runningCount = queries.filter((q) => isInProgress(q.status)).length;
  const failedCount = queries.filter((q) => q.status === "FAILED").length;
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
        setFormOpen(false);
        setKeyword("");
        router.push(`/research-hub/product-discovery/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat pencarian."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Strip ringkasan bento */}
      {queries.length > 0 ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          <div className="bento-tile border-transparent bg-violet-600 shadow-md shadow-violet-600/20 dark:bg-violet-500">
            <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
              Total produk
            </span>
            <span className="bento-value text-white dark:text-violet-950">
              {totalProducts.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium text-violet-100/90 dark:text-violet-900/80">
              dari {queries.length} pencarian keyword
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Pencarian</span>
            <span className="bento-value">
              {queries.length.toLocaleString("id-ID")}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              limit {MIN_PRODUCT_LIMIT}–{MAX_PRODUCT_LIMIT} produk per query
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
            <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
              Siap dianalisis
            </span>
            <span className="bento-value text-violet-900 dark:text-violet-300">
              {readyCount.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium text-violet-700/70 dark:text-violet-300/70">
              pencarian berstatus siap
            </span>
          </div>

          {failedCount > 0 ? (
            <div className="bento-tile border-transparent bg-[#fbdcd7] dark:bg-rose-400/10">
              <span className="text-[11.5px] font-semibold text-rose-800/70 dark:text-rose-200/60">
                Gagal
              </span>
              <span className="bento-value text-rose-900 dark:text-rose-300">
                {failedCount.toLocaleString("id-ID")}
              </span>
              <span className="text-[11px] font-medium text-rose-800/70 dark:text-rose-300/70">
                coba refresh untuk mengulang
              </span>
            </div>
          ) : (
            <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
              <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
                Berjalan
              </span>
              <span className="bento-value text-amber-900 dark:text-amber-300">
                {runningCount.toLocaleString("id-ID")}
              </span>
              <span className="text-[11px] font-medium text-amber-800/70 dark:text-amber-300/70">
                scraping di background
              </span>
            </div>
          )}
        </div>
      ) : null}

      {hasInProgress ? (
        <div className={lab.entrance}>
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

      {/* Daftar pencarian + form collapsible */}
      <section className={cn(lab.section, lab.entrance)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={lab.sectionTitle}>Pencarian produk</h2>
            <p className={lab.sectionDesc}>
              {queries.length === 0
                ? "Mulai dengan keyword pertama Anda di bawah."
                : `${queries.length} pencarian · ${totalProducts.toLocaleString("id-ID")} produk dari marketplace.`}
            </p>
          </div>
          {queries.length > 0 ? (
            <Button
              variant={formOpen ? "outline" : "default"}
              onClick={() => setFormOpen((v) => !v)}
            >
              {formOpen ? <X /> : <Plus />}
              {formOpen ? "Tutup" : "Pencarian baru"}
            </Button>
          ) : null}
        </div>

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
                Cari produk by keyword
              </p>
              <p className="text-muted-foreground text-sm">
                Masukkan keyword seperti &quot;body serum&quot; untuk menarik
                puluhan produk dari berbagai brand sekaligus.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="pd-keyword">Keyword</Label>
                <Input
                  id="pd-keyword"
                  placeholder='Mis. "body serum"'
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pd-limit">
                  Jumlah produk (max {MAX_PRODUCT_LIMIT})
                </Label>
                <Input
                  id="pd-limit"
                  type="number"
                  min={MIN_PRODUCT_LIMIT}
                  max={MAX_PRODUCT_LIMIT}
                  value={productLimit}
                  disabled={pending}
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
            </div>
            <div className="grid gap-1.5">
              <Label>Marketplace</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_MARKETPLACES.map((mp) => (
                  <label
                    key={mp}
                    className={cn(
                      "border-border/70 flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                      marketplaces.includes(mp)
                        ? "border-[color-mix(in_srgb,var(--lab-accent,var(--primary))_45%,var(--border))] bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_8%,transparent)]"
                        : "hover:bg-muted/60",
                    )}
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">
                Produk ditarik dari {marketplaces.length || "—"} marketplace
                terpilih, lalu dianalisis AI otomatis.
              </p>
              <Button onClick={handleCreate} disabled={pending}>
                {pending ? (
                  <RefreshCw className="animate-spin" />
                ) : (
                  <PackageSearch />
                )}
                {pending ? "Memulai…" : "Tarik produk"}
              </Button>
            </div>
          </div>
        ) : null}

        {queries.length === 0 && !formOpen ? (
          <LabEmptyState
            icon={PackageSearch}
            title="Belum ada pencarian produk"
            description='Masukkan keyword seperti "body serum" untuk menarik puluhan produk dari berbagai brand di Shopee, Tokopedia, atau TikTok Shop.'
            action={
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="size-3.5" aria-hidden />
                Pencarian Baru
              </Button>
            }
          />
        ) : queries.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {queries.map((q) => (
              <div
                key={q.id}
                className={cn(lab.card, "group flex flex-col p-0")}
              >
                <Link
                  href={`/research-hub/product-discovery/${q.id}`}
                  className="flex flex-1 flex-col gap-4 p-5 pb-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-extrabold uppercase"
                        aria-hidden
                      >
                        {q.keyword.trim().charAt(0) || "?"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground truncate font-bold tracking-tight">
                          {q.keyword}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {q.marketplaces
                            .map((mp) => MARKETPLACE_LABELS[mp])
                            .join(", ")}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={q.status} />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <CardStat
                      label="Produk"
                      value={
                        q.productCount > 0
                          ? q.productCount.toLocaleString("id-ID")
                          : "—"
                      }
                    />
                    <CardStat label="Limit" value={q.productLimit} />
                    <CardStat
                      label="Dibuat"
                      value={formatRelativeTime(new Date(q.createdAt))}
                    />
                  </div>

                  {q.status === "FAILED" && q.errorMessage ? (
                    <p className="text-rose-600 dark:text-rose-400 line-clamp-2 text-xs">
                      {q.errorMessage}
                    </p>
                  ) : null}
                </Link>

                <div className="border-border/60 flex items-center justify-between gap-2 border-t px-3 py-2">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                    <PackageSearch className="size-3.5" aria-hidden />
                    {q.marketplaces.length} marketplace
                  </span>
                  <div className="flex items-center gap-1">
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
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
