"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  MARKETPLACE_LABELS,
  PRODUCT_DISCOVERY_STATUS_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
import { lab, LabEmptyState } from "@/components/lab/lab-primitives";
import {
  MarketplaceLogo,
  MarketplaceLogoStrip,
} from "@/components/research-hub/marketplace-logo";
import { RunLedger, countRunTones } from "@/components/research-hub/kit/run-ledger";
import { RunStatusBadge, type RunTone } from "@/components/research-hub/kit/run-status";
import {
  ResearchFilterBar,
  filterRuns,
  type RunToneFilter,
} from "@/components/research-hub/kit/research-filter-bar";
import {
  ResearchTable,
  SortableHead,
  useSortedRows,
} from "@/components/research-hub/kit/research-table";
import { cn } from "@/lib/utils";
import { useProductDiscoveryPolling } from "./use-product-discovery-polling";
import { ResearchFilterEmpty } from "@/components/research-hub/kit/research-section";

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

function toneOf(status: ProductDiscoveryStatus): RunTone {
  if (status === "READY") return "ready";
  if (status === "FAILED") return "failed";
  if (status === "SCRAPING" || status === "PENDING") return "running";
  return "idle";
}

const LEDGER_LABELS = { running: "Mengambil produk" } as const;

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
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RunToneFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<ProductDiscoveryQueryRow | null>(null);

  const hasInProgress = queries.some((q) => q.status === "SCRAPING");
  const totalProducts = queries.reduce((sum, q) => sum + q.productCount, 0);
  const counts = useMemo(() => countRunTones(queries, (q) => toneOf(q.status)), [queries]);

  useProductDiscoveryPolling(hasInProgress);

  const filtered = useMemo(
    () =>
      filterRuns(queries, {
        search,
        status,
        text: (q) => `${q.keyword} ${q.marketplaces.map((mp) => MARKETPLACE_LABELS[mp]).join(" ")}`,
        tone: (q) => toneOf(q.status),
      }),
    [queries, search, status],
  );

  const { sorted, sort, toggle } = useSortedRows(filtered, {
    keyword: (q) => q.keyword,
    products: (q) => q.productCount,
    created: (q) => q.createdAt,
  });

  function toggleMarketplace(mp: ResearchMarketplace) {
    setMarketplaces((prev) =>
      prev.includes(mp) ? prev.filter((p) => p !== mp) : [...prev, mp],
    );
  }

  function handleCreate() {
    if (!keyword.trim()) {
      toast.error("Isi keyword dulu, mis. \"body serum\".");
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
        toast.success("Pencarian dimulai. Produk ditarik di background.");
        setFormOpen(false);
        setKeyword("");
        router.push(`/research-hub/product-discovery/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Pencarian gagal dimulai."));
      }
    });
  }

  function handleRefresh(q: ProductDiscoveryQueryRow) {
    startTransition(async () => {
      try {
        await refreshProductDiscoveryQuery(q.id);
        toast.success(`"${q.keyword}" diambil ulang.`);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengambil ulang."));
      }
    });
  }

  function handleDelete() {
    const target = deleteTarget;
    if (!target) return;
    startTransition(async () => {
      try {
        await deleteProductDiscoveryQuery(target.id);
        toast.success(`"${target.keyword}" dihapus.`);
        setDeleteTarget(null);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {queries.length > 0 ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
          <RunLedger
            className="flex-1"
            counts={counts}
            noun="pencarian keyword"
            labels={LEDGER_LABELS}
            detail={`${totalProducts.toLocaleString("id-ID")} produk terkumpul`}
          />
          <Button
            variant={formOpen ? "outline" : "default"}
            onClick={() => setFormOpen((v) => !v)}
            aria-expanded={formOpen}
            aria-controls="pd-form"
          >
            {formOpen ? <X aria-hidden /> : <Plus aria-hidden />}
            {formOpen ? "Tutup form" : "Pencarian baru"}
          </Button>
        </div>
      ) : null}

      {hasInProgress ? (
        <p className="rh-meta" aria-live="polite">
          Ada pencarian yang masih mengambil produk. Halaman ini diperbarui
          otomatis setiap beberapa detik.
        </p>
      ) : null}

      {formOpen ? (
        <section
          id="pd-form"
          aria-labelledby="pd-form-title"
          className={cn(
            lab.panel,
            "grid gap-5",
            "animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none",
          )}
        >
          <div className="space-y-1">
            <h2 id="pd-form-title" className="rh-section-title">
              Tarik produk dari keyword
            </h2>
            <p className="rh-lede">
              Satu keyword menarik puluhan produk dari berbagai brand dan
              toko sekaligus, lalu dianalisis AI.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="pd-keyword">Keyword</Label>
              <Input
                id="pd-keyword"
                placeholder='Mis. "body serum"'
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
                disabled={pending}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pd-limit">Jumlah produk</Label>
              <Input
                id="pd-limit"
                type="number"
                min={MIN_PRODUCT_LIMIT}
                max={MAX_PRODUCT_LIMIT}
                value={productLimit}
                disabled={pending}
                aria-describedby="pd-limit-hint"
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
              <p id="pd-limit-hint" className="rh-meta">
                {MIN_PRODUCT_LIMIT} sampai {MAX_PRODUCT_LIMIT} produk.
              </p>
            </div>
          </div>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Marketplace</legend>
            <div className="flex flex-wrap gap-2">
              {ALL_MARKETPLACES.map((mp) => {
                const checked = marketplaces.includes(mp);
                return (
                  <label
                    key={mp}
                    className={cn(
                      "border-border flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                      checked
                        ? "border-[color-mix(in_srgb,var(--lab-accent,var(--primary))_45%,var(--border))] bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_8%,transparent)]"
                        : "hover:bg-muted/60",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleMarketplace(mp)}
                    />
                    <MarketplaceLogo marketplace={mp} className="size-4" />
                    {MARKETPLACE_LABELS[mp]}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {queries.length > 0 ? (
              <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={pending}>
                Batal
              </Button>
            ) : null}
            <Button onClick={handleCreate} disabled={pending}>
              {pending ? (
                <RefreshCw className="animate-spin" aria-hidden />
              ) : (
                <PackageSearch aria-hidden />
              )}
              {pending ? "Memulai…" : "Tarik produk"}
            </Button>
          </div>
        </section>
      ) : null}

      {queries.length === 0 && !formOpen ? (
        <LabEmptyState
          icon={PackageSearch}
          title="Belum ada pencarian produk"
          description='Mulai dari satu keyword, mis. "body serum", untuk menarik produk dari Shopee, Tokopedia, atau TikTok Shop.'
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-3.5" aria-hidden />
              Pencarian baru
            </Button>
          }
        />
      ) : null}

      {queries.length > 0 ? (
        <section aria-label="Daftar pencarian" className="flex flex-col gap-3">
          <ResearchFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Cari keyword atau marketplace…"
            status={status}
            onStatusChange={setStatus}
            statusCounts={counts}
            statusLabels={LEDGER_LABELS}
            resultCount={filtered.length}
            totalCount={queries.length}
            onReset={() => {
              setSearch("");
              setStatus("all");
            }}
          />

          {sorted.length === 0 ? (
            <ResearchFilterEmpty>Tidak ada pencarian yang cocok dengan filter ini.</ResearchFilterEmpty>
          ) : (
            <ResearchTable maxHeight="70vh">
              <TableHeader sticky>
                <TableRow>
                  <SortableHead sortKey="keyword" sort={sort} onSort={toggle}>
                    Keyword
                  </SortableHead>
                  <TableHead>Marketplace</TableHead>
                  <TableHead>Status</TableHead>
                  <SortableHead sortKey="products" sort={sort} onSort={toggle} align="right">
                    Produk
                  </SortableHead>
                  <SortableHead sortKey="created" sort={sort} onSort={toggle}>
                    Dibuat
                  </SortableHead>
                  <TableHead className="w-0 text-right">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((q) => {
                  const tone = toneOf(q.status);
                  return (
                    <TableRow key={q.id} className="group">
                      <TableCell className="max-w-[22rem] whitespace-normal">
                        <Link
                          href={`/research-hub/product-discovery/${q.id}`}
                          className="text-foreground focus-visible:ring-ring rounded font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        >
                          {q.keyword}
                        </Link>
                        {tone === "failed" && q.errorMessage ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-rose-700 dark:text-rose-300">
                            {q.errorMessage}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <span
                          className="inline-flex items-center gap-1.5"
                          title={q.marketplaces.map((mp) => MARKETPLACE_LABELS[mp]).join(", ")}
                        >
                          <MarketplaceLogoStrip marketplaces={q.marketplaces} iconClassName="size-4" />
                          <span className="sr-only">
                            {q.marketplaces.map((mp) => MARKETPLACE_LABELS[mp]).join(", ")}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <RunStatusBadge tone={tone} label={PRODUCT_DISCOVERY_STATUS_LABELS[q.status]} />
                      </TableCell>
                      <TableCell className="rh-num text-right">
                        {q.productCount > 0 ? (
                          <>
                            {q.productCount.toLocaleString("id-ID")}
                            <span className="text-muted-foreground"> / {q.productLimit}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <time dateTime={q.createdAt} title={new Date(q.createdAt).toLocaleString("id-ID")}>
                          {formatRelativeTime(new Date(q.createdAt))}
                        </time>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-0.5">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            disabled={pending || q.status === "SCRAPING"}
                            onClick={() => handleRefresh(q)}
                            aria-label={`Ambil ulang "${q.keyword}"`}
                            title="Ambil ulang"
                          >
                            <RefreshCw aria-hidden />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            disabled={pending}
                            onClick={() => setDeleteTarget(q)}
                            aria-label={`Hapus "${q.keyword}"`}
                            title="Hapus"
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </ResearchTable>
          )}
        </section>
      ) : null}

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Hapus pencarian "${deleteTarget?.keyword ?? ""}"?`}
        description={`${deleteTarget?.productCount ?? 0} produk dan hasil analisisnya ikut terhapus. Tindakan ini tidak bisa dibatalkan.`}
        confirmLabel="Hapus pencarian"
        pending={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
