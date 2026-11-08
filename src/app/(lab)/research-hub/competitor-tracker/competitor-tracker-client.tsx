"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ResearchMarketplace } from "@prisma/client";
import { Plus, RefreshCw, Store, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  deleteResearchCompetitor,
  refreshResearchCompetitor,
} from "@/actions/research-competitor";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MARKETPLACE_LABELS } from "@/lib/research/labels";
import { LabEmptyState } from "@/components/lab/lab-primitives";
import { MarketplaceLogo } from "@/components/research-hub/marketplace-logo";
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
import { CompetitorShopForm } from "./competitor-shop-form";

export type CompetitorCard = {
  id: string;
  name: string;
  brand: string;
  category: string;
  marketplace: ResearchMarketplace;
  shopUrl: string;
  isActive: boolean;
  skuCount: number;
  avgRating: number | null;
  unreadAlerts: number;
};

/**
 * Toko kompetitor tidak menyimpan status scrape sendiri; statusnya diturunkan
 * dari data: dipantau (aktif + punya SKU) atau belum dipantau (nonaktif /
 * katalog masih kosong).
 */
function toneOf(c: CompetitorCard): RunTone {
  return c.isActive && c.skuCount > 0 ? "ready" : "idle";
}

function statusLabel(c: CompetitorCard) {
  if (!c.isActive) return "Nonaktif";
  return c.skuCount > 0 ? "Dipantau" : "Belum ada SKU";
}

const LEDGER_LABELS = { ready: "Dipantau", idle: "Belum dipantau" } as const;

export function CompetitorTrackerClient({
  competitors,
}: {
  competitors: CompetitorCard[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(competitors.length === 0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RunToneFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<CompetitorCard | null>(null);

  const totalSkus = competitors.reduce((sum, c) => sum + c.skuCount, 0);
  const totalAlerts = competitors.reduce((sum, c) => sum + c.unreadAlerts, 0);
  const counts = useMemo(() => countRunTones(competitors, toneOf), [competitors]);

  const filtered = useMemo(
    () =>
      filterRuns(competitors, {
        search,
        status,
        text: (c) =>
          `${c.name} ${c.brand} ${c.category} ${MARKETPLACE_LABELS[c.marketplace]}`,
        tone: toneOf,
      }),
    [competitors, search, status],
  );

  const { sorted, sort, toggle } = useSortedRows(filtered, {
    name: (c) => c.name,
    brand: (c) => c.brand,
    skus: (c) => c.skuCount,
    rating: (c) => c.avgRating,
    alerts: (c) => c.unreadAlerts,
  });

  function handleRefresh(c: CompetitorCard) {
    startTransition(async () => {
      try {
        await refreshResearchCompetitor(c.id);
        toast.success(`"${c.name}" ditarik ulang di background.`);
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
        await deleteResearchCompetitor(target.id);
        toast.success(`"${target.name}" dihapus.`);
        setDeleteTarget(null);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, `"${target.name}" gagal dihapus.`));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <CompetitorTrackerModeNav className="lg:hidden" />

      {competitors.length > 0 ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
          <RunLedger
            className="flex-1"
            counts={counts}
            noun="toko kompetitor"
            labels={LEDGER_LABELS}
            detail={`${totalSkus.toLocaleString("id-ID")} SKU dipantau, ${totalAlerts.toLocaleString("id-ID")} alert belum dibaca`}
          />
          <Button
            variant={formOpen ? "outline" : "default"}
            onClick={() => setFormOpen((v) => !v)}
            aria-expanded={formOpen}
            aria-controls="ct-shop-form"
          >
            {formOpen ? <X aria-hidden /> : <Plus aria-hidden />}
            {formOpen ? "Tutup form" : "Tambah toko"}
          </Button>
        </div>
      ) : null}

      {formOpen ? (
        <CompetitorShopForm
          id="ct-shop-form"
          onCancel={competitors.length > 0 ? () => setFormOpen(false) : undefined}
        />
      ) : null}

      {competitors.length === 0 && !formOpen ? (
        <LabEmptyState
          icon={Store}
          title="Belum ada toko kompetitor"
          description="Tambahkan URL toko kompetitor untuk memantau harga, SKU baru, dan promonya setiap hari."
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-3.5" aria-hidden />
              Tambah toko
            </Button>
          }
        />
      ) : null}

      {competitors.length > 0 ? (
        <section aria-label="Daftar toko kompetitor" className="flex flex-col gap-3">
          <ResearchFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Cari toko, brand, atau kategori…"
            status={status}
            onStatusChange={setStatus}
            statusCounts={counts}
            statusLabels={LEDGER_LABELS}
            resultCount={filtered.length}
            totalCount={competitors.length}
            onReset={() => {
              setSearch("");
              setStatus("all");
            }}
          />

          {sorted.length === 0 ? (
            <p className="rh-meta border-border rounded-xl border border-dashed px-5 py-8 text-center text-[13px]">
              Tidak ada toko yang cocok dengan filter ini.
            </p>
          ) : (
            <ResearchTable maxHeight="70vh">
              <TableHeader sticky>
                <TableRow>
                  <SortableHead sortKey="name" sort={sort} onSort={toggle}>
                    Toko
                  </SortableHead>
                  <SortableHead sortKey="brand" sort={sort} onSort={toggle}>
                    Brand
                  </SortableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Marketplace</TableHead>
                  <TableHead>Status</TableHead>
                  <SortableHead sortKey="skus" sort={sort} onSort={toggle} align="right">
                    SKU
                  </SortableHead>
                  <SortableHead sortKey="rating" sort={sort} onSort={toggle} align="right">
                    Rating
                  </SortableHead>
                  <SortableHead sortKey="alerts" sort={sort} onSort={toggle} align="right">
                    Alert baru
                  </SortableHead>
                  <TableHead className="w-0 text-right">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-[20rem] whitespace-normal">
                      <Link
                        href={`/research-hub/competitor-tracker/${c.id}`}
                        className="text-foreground focus-visible:ring-ring rounded font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>{c.brand}</TableCell>
                    <TableCell className="text-muted-foreground">{c.category}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <MarketplaceLogo marketplace={c.marketplace} className="size-4" />
                        {MARKETPLACE_LABELS[c.marketplace]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <RunStatusBadge tone={toneOf(c)} label={statusLabel(c)} />
                    </TableCell>
                    <TableCell className="rh-num text-right">
                      {c.skuCount.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell className="rh-num text-right">
                      {c.avgRating != null ? (
                        c.avgRating.toFixed(1)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-0.5">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => handleRefresh(c)}
                          aria-label={`Tarik ulang "${c.name}"`}
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
                          aria-label={`Hapus "${c.name}"`}
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
        title={`Hapus toko "${deleteTarget?.name ?? ""}"?`}
        description={`${(deleteTarget?.skuCount ?? 0).toLocaleString("id-ID")} SKU, riwayat harga, alert, dan rencana respons AI toko ini ikut terhapus. Tindakan ini tidak bisa dibatalkan.`}
        confirmLabel="Hapus toko"
        pending={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
