"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { FolderPlus, Loader2, Package, Plus, RefreshCw, Trash2, X } from "lucide-react";
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
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { lab, LabEmptyState } from "@/components/lab/lab-primitives";
import { CompetitorTrackerModeNav } from "@/components/research-hub/competitor-tracker-mode-nav";
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

/** Kategori dipantau bila aktif dan sudah berisi produk. */
function toneOf(c: CompetitorProductCategoryCard): RunTone {
  return c.isActive && c.productCount > 0 ? "ready" : "idle";
}

function statusLabel(c: CompetitorProductCategoryCard) {
  if (!c.isActive) return "Nonaktif";
  return c.productCount > 0 ? "Dipantau" : "Belum ada produk";
}

const LEDGER_LABELS = { ready: "Dipantau", idle: "Belum dipantau" } as const;

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
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RunToneFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<CompetitorProductCategoryCard | null>(null);

  const totalProducts = categories.reduce((sum, c) => sum + c.productCount, 0);
  const totalAlerts = categories.reduce((sum, c) => sum + c.unreadAlerts, 0);
  const counts = useMemo(() => countRunTones(categories, toneOf), [categories]);

  const filtered = useMemo(
    () =>
      filterRuns(categories, {
        search,
        status,
        text: (c) => `${c.name} ${c.description ?? ""}`,
        tone: toneOf,
      }),
    [categories, search, status],
  );

  const { sorted, sort, toggle } = useSortedRows(filtered, {
    name: (c) => c.name,
    products: (c) => c.productCount,
    alerts: (c) => c.unreadAlerts,
    updated: (c) => c.updatedAt,
  });

  function handleCreate() {
    if (!name.trim()) {
      toast.error("Isi nama kategori dulu, mis. \"Deodorant\".");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createCompetitorProductCategory({
          name,
          description: description || undefined,
        });
        toast.success(`Kategori "${name.trim()}" dibuat.`);
        setFormOpen(false);
        setName("");
        setDescription("");
        router.push(`/research-hub/competitor-tracker/products/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Kategori gagal dibuat. Coba lagi."));
      }
    });
  }

  function handleRefresh(c: CompetitorProductCategoryCard) {
    startTransition(async () => {
      try {
        await refreshCompetitorProductCategory(c.id);
        toast.success(`Produk di "${c.name}" ditarik ulang di background.`);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, `"${c.name}" gagal ditarik ulang. Coba lagi sebentar.`));
      }
    });
  }

  function handleDelete() {
    const target = deleteTarget;
    if (!target) return;
    startTransition(async () => {
      try {
        await deleteCompetitorProductCategory(target.id);
        toast.success(`Kategori "${target.name}" dihapus.`);
        setDeleteTarget(null);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, `Kategori "${target.name}" gagal dihapus.`));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <CompetitorTrackerModeNav className="lg:hidden" />

      {categories.length > 0 ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
          <RunLedger
            className="flex-1"
            counts={counts}
            noun="kategori produk"
            labels={LEDGER_LABELS}
            detail={`${totalProducts.toLocaleString("id-ID")} produk dipantau, ${totalAlerts.toLocaleString("id-ID")} alert belum dibaca`}
          />
          <Button
            variant={formOpen ? "outline" : "default"}
            onClick={() => setFormOpen((v) => !v)}
            aria-expanded={formOpen}
            aria-controls="ct-category-form"
          >
            {formOpen ? <X aria-hidden /> : <Plus aria-hidden />}
            {formOpen ? "Tutup form" : "Kategori baru"}
          </Button>
        </div>
      ) : null}

      {formOpen ? (
        <section
          id="ct-category-form"
          aria-labelledby="ct-category-form-title"
          className={cn(
            lab.panel,
            "grid gap-5",
            "animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none",
          )}
        >
          <div className="space-y-1">
            <h2 id="ct-category-form-title" className="rh-section-title">
              Buat kategori produk
            </h2>
            <p className="rh-lede">
              Kelompokkan produk kompetitor per kategori pasar, lalu tambahkan
              URL produk spesifik di dalamnya.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cat-name">Nama kategori</Label>
            <Input
              id="cat-name"
              placeholder="Mis. Deodorant"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
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
          <div className="flex flex-wrap items-center justify-end gap-3">
            {categories.length > 0 ? (
              <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={pending}>
                Batal
              </Button>
            ) : null}
            <Button onClick={handleCreate} disabled={pending || !name.trim()}>
              {pending ? (
                <Loader2 className="motion-safe:animate-spin" aria-hidden />
              ) : (
                <FolderPlus aria-hidden />
              )}
              {pending ? "Membuat…" : "Buat kategori"}
            </Button>
          </div>
        </section>
      ) : null}

      {categories.length === 0 && !formOpen ? (
        <LabEmptyState
          icon={Package}
          title="Belum ada kategori produk"
          description="Buat kategori, mis. Deodorant, lalu tambahkan URL produk kompetitor untuk memantau harga dan metriknya."
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-3.5" aria-hidden />
              Kategori baru
            </Button>
          }
        />
      ) : null}

      {categories.length > 0 ? (
        <section aria-label="Daftar kategori produk" className="flex flex-col gap-3">
          <ResearchFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Cari kategori…"
            status={status}
            onStatusChange={setStatus}
            statusCounts={counts}
            statusLabels={LEDGER_LABELS}
            resultCount={filtered.length}
            totalCount={categories.length}
            onReset={() => {
              setSearch("");
              setStatus("all");
            }}
          />

          {sorted.length === 0 ? (
            <p className="rh-meta border-border rounded-xl border border-dashed px-5 py-8 text-center text-[13px]">
              Tidak ada kategori yang cocok dengan filter ini.
            </p>
          ) : (
            <ResearchTable maxHeight="70vh">
              <TableHeader sticky>
                <TableRow>
                  <SortableHead sortKey="name" sort={sort} onSort={toggle}>
                    Kategori
                  </SortableHead>
                  <TableHead>Status</TableHead>
                  <SortableHead sortKey="products" sort={sort} onSort={toggle} align="right">
                    Produk
                  </SortableHead>
                  <SortableHead sortKey="alerts" sort={sort} onSort={toggle} align="right">
                    Alert baru
                  </SortableHead>
                  <SortableHead sortKey="updated" sort={sort} onSort={toggle}>
                    Diperbarui
                  </SortableHead>
                  <TableHead className="w-0 text-right">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-[28rem] whitespace-normal">
                      <Link
                        href={`/research-hub/competitor-tracker/products/${c.id}`}
                        className="text-foreground focus-visible:ring-ring rounded font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {c.name}
                      </Link>
                      {c.description ? (
                        <p className="rh-meta mt-0.5 line-clamp-1">{c.description}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <RunStatusBadge tone={toneOf(c)} label={statusLabel(c)} />
                    </TableCell>
                    <TableCell className="rh-num text-right">
                      {c.productCount.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="rh-num text-right">
                      {c.unreadAlerts > 0 ? (
                        <span className="font-medium text-amber-700 dark:text-amber-300">
                          {c.unreadAlerts.toLocaleString("id-ID")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <time dateTime={c.updatedAt} title={new Date(c.updatedAt).toLocaleString("id-ID")}>
                        {formatRelativeTime(new Date(c.updatedAt))}
                      </time>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-0.5">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => handleRefresh(c)}
                          aria-label={`Tarik ulang produk di "${c.name}"`}
                          title="Tarik ulang"
                        >
                          <RefreshCw aria-hidden />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive"
                          disabled={pending}
                          onClick={() => setDeleteTarget(c)}
                          aria-label={`Hapus kategori "${c.name}"`}
                          title="Hapus"
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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
        title={`Hapus kategori "${deleteTarget?.name ?? ""}"?`}
        description={`${(deleteTarget?.productCount ?? 0).toLocaleString("id-ID")} produk yang dipantau beserta riwayat harga dan alertnya ikut terhapus. Tindakan ini tidak bisa dibatalkan.`}
        confirmLabel="Hapus kategori"
        pending={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
