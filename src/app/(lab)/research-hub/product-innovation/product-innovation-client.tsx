"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Lightbulb, Plus, Trash2, X } from "lucide-react";
import { ProductInnovationStatus } from "@prisma/client";
import { toast } from "sonner";
import { deleteProductInnovation } from "@/actions/research-product-innovation";
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
import { formatRelativeTime } from "@/lib/research/labels";
import { LabEmptyState } from "@/components/lab/lab-primitives";
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
import { NewInnovationForm, type BaseConceptOption } from "./new-innovation-form";

export type { BaseConceptOption };

export type InnovationRow = {
  id: string;
  title: string;
  baseProduct: string;
  category: string;
  status: ProductInnovationStatus;
  ideaCount: number;
  promotedCount: number;
  createdAt: string;
};

const STATUS_LABELS: Record<ProductInnovationStatus, string> = {
  DRAFT: "Draft",
  GENERATING: "Menyusun ide",
  READY: "Siap",
  FAILED: "Gagal",
};

function toneOf(status: ProductInnovationStatus): RunTone {
  if (status === "READY") return "ready";
  if (status === "FAILED") return "failed";
  if (status === "GENERATING") return "running";
  return "idle";
}

const LEDGER_LABELS = { running: "Menyusun ide", idle: "Draft" } as const;

export function ProductInnovationClient({
  innovations,
  baseConcepts,
}: {
  innovations: InnovationRow[];
  baseConcepts: BaseConceptOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(innovations.length === 0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RunToneFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<InnovationRow | null>(null);

  const hasInProgress = innovations.some((i) => i.status === "GENERATING");
  const counts = useMemo(() => countRunTones(innovations, (i) => toneOf(i.status)), [innovations]);
  const promotedTotal = innovations.reduce((n, i) => n + i.promotedCount, 0);
  const ideasTotal = innovations.reduce((n, i) => n + i.ideaCount, 0);

  useEffect(() => {
    if (!hasInProgress) return;
    const id = window.setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 12_000);
    return () => window.clearInterval(id);
  }, [hasInProgress, router]);

  const filtered = useMemo(
    () =>
      filterRuns(innovations, {
        search,
        status,
        text: (i) => `${i.baseProduct} ${i.category} ${i.title}`,
        tone: (i) => toneOf(i.status),
      }),
    [innovations, search, status],
  );

  const { sorted, sort, toggle } = useSortedRows(filtered, {
    base: (i) => i.baseProduct,
    category: (i) => i.category,
    ideas: (i) => i.ideaCount,
    promoted: (i) => i.promotedCount,
    created: (i) => i.createdAt,
  });

  function handleDelete() {
    const target = deleteTarget;
    if (!target) return;
    startTransition(async () => {
      try {
        await deleteProductInnovation(target.id);
        toast.success(`Sesi "${target.baseProduct}" dihapus.`);
        setDeleteTarget(null);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Sesi gagal dihapus."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {innovations.length > 0 ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
          <RunLedger
            className="flex-1"
            counts={counts}
            noun="sesi inovasi"
            labels={LEDGER_LABELS}
            detail={`${ideasTotal.toLocaleString("id-ID")} ide, ${promotedTotal} jadi konsep`}
          />
          <Button
            variant={formOpen ? "outline" : "default"}
            onClick={() => setFormOpen((v) => !v)}
            aria-expanded={formOpen}
            aria-controls="innovation-form"
          >
            {formOpen ? <X aria-hidden /> : <Plus aria-hidden />}
            {formOpen ? "Tutup form" : "Sesi baru"}
          </Button>
        </div>
      ) : null}

      {hasInProgress ? (
        <p className="rh-meta" aria-live="polite">
          Ada sesi yang masih menyusun ide. Halaman ini diperbarui otomatis
          setiap beberapa detik.
        </p>
      ) : null}

      {formOpen ? (
        <NewInnovationForm
          id="innovation-form"
          baseConcepts={baseConcepts}
          onCancel={innovations.length > 0 ? () => setFormOpen(false) : undefined}
          onCreated={() => setFormOpen(false)}
        />
      ) : null}

      {innovations.length === 0 && !formOpen ? (
        <LabEmptyState
          icon={Lightbulb}
          title="Belum ada sesi inovasi"
          description="Mulai sesi SCAMPER dari produk basis atau dari konsep yang sudah ada di Concept Lab."
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-3.5" aria-hidden />
              Sesi baru
            </Button>
          }
        />
      ) : null}

      {innovations.length > 0 ? (
        <section aria-label="Daftar sesi inovasi" className="flex flex-col gap-3">
          <ResearchFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Cari produk basis atau kategori…"
            status={status}
            onStatusChange={setStatus}
            statusCounts={counts}
            statusLabels={LEDGER_LABELS}
            resultCount={filtered.length}
            totalCount={innovations.length}
            onReset={() => {
              setSearch("");
              setStatus("all");
            }}
          />

          {sorted.length === 0 ? (
            <p className="rh-meta border-border rounded-xl border border-dashed px-5 py-8 text-center text-[13px]">
              Tidak ada sesi yang cocok dengan filter ini.
            </p>
          ) : (
            <ResearchTable maxHeight="70vh">
              <TableHeader sticky>
                <TableRow>
                  <SortableHead sortKey="base" sort={sort} onSort={toggle}>
                    Produk basis
                  </SortableHead>
                  <SortableHead sortKey="category" sort={sort} onSort={toggle}>
                    Kategori
                  </SortableHead>
                  <TableHead>Status</TableHead>
                  <SortableHead sortKey="ideas" sort={sort} onSort={toggle} align="right">
                    Ide
                  </SortableHead>
                  <SortableHead sortKey="promoted" sort={sort} onSort={toggle} align="right">
                    Jadi konsep
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
                {sorted.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="max-w-[22rem] whitespace-normal">
                      <Link
                        href={`/research-hub/product-innovation/${i.id}`}
                        className="text-foreground focus-visible:ring-ring rounded font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {i.baseProduct}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[14rem] truncate">
                      {i.category}
                    </TableCell>
                    <TableCell>
                      <RunStatusBadge tone={toneOf(i.status)} label={STATUS_LABELS[i.status]} />
                    </TableCell>
                    <TableCell className="rh-num text-right">
                      {i.ideaCount > 0 ? i.ideaCount : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="rh-num text-right">
                      {i.promotedCount > 0 ? (
                        i.promotedCount
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <time dateTime={i.createdAt} title={new Date(i.createdAt).toLocaleString("id-ID")}>
                        {formatRelativeTime(new Date(i.createdAt))}
                      </time>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={pending}
                        onClick={() => setDeleteTarget(i)}
                        aria-label={`Hapus sesi "${i.baseProduct}"`}
                        title="Hapus"
                      >
                        <Trash2 aria-hidden />
                      </Button>
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
        title={`Hapus sesi "${deleteTarget?.baseProduct ?? ""}"?`}
        description={`${deleteTarget?.ideaCount ?? 0} ide SCAMPER di sesi ini ikut terhapus. Konsep yang sudah dibuat dari ide tetap ada di Concept Lab. Tindakan ini tidak bisa dibatalkan.`}
        confirmLabel="Hapus sesi"
        pending={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
