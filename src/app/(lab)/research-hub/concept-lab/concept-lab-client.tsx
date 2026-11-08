"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { FlaskConical, GitCompare, Plus, Trash2, X } from "lucide-react";
import { ProductConceptMode, ProductConceptStatus } from "@prisma/client";
import { toast } from "sonner";
import { deleteProductConcept } from "@/actions/research-concept-lab";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  PRODUCT_CONCEPT_MODE_LABELS,
  PRODUCT_CONCEPT_STATUS_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
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
import { cn } from "@/lib/utils";
import { NewConceptForm } from "./new-concept-form";

export type ConceptRow = {
  id: string;
  title: string;
  category: string;
  mode: ProductConceptMode;
  status: ProductConceptStatus;
  overallScore: number | null;
  decision: string | null;
  uspGapAnalysisId: string | null;
  createdAt: string;
};

function toneOf(status: ProductConceptStatus): RunTone {
  if (status === "READY" || status === "SENT_TO_RND") return "ready";
  if (status === "VALIDATING") return "running";
  return "idle";
}

const LEDGER_LABELS = { ready: "Siap brief", running: "Divalidasi", idle: "Draft" } as const;

const DECISION_LABEL: Record<string, string> = {
  GO: "GO",
  NO_GO: "NO GO",
  PIVOT: "Pivot",
};

function decisionClass(decision: string | null): string {
  switch (decision) {
    case "GO":
      return "text-emerald-700 dark:text-emerald-300";
    case "NO_GO":
      return "text-rose-700 dark:text-rose-300";
    case "PIVOT":
      return "text-amber-700 dark:text-amber-300";
    default:
      return "text-muted-foreground";
  }
}

export function ConceptLabClient({ concepts }: { concepts: ConceptRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(concepts.length === 0);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RunToneFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<ConceptRow | null>(null);

  const hasInProgress = concepts.some((c) => c.status === "VALIDATING");
  const archivedCount = concepts.filter((c) => c.status === "ARCHIVED").length;
  const active = useMemo(
    () => (showArchived ? concepts : concepts.filter((c) => c.status !== "ARCHIVED")),
    [concepts, showArchived],
  );
  const counts = useMemo(() => countRunTones(active, (c) => toneOf(c.status)), [active]);
  const goCount = concepts.filter((c) => c.decision === "GO").length;
  const fromUspCount = concepts.filter((c) => c.uspGapAnalysisId).length;

  useEffect(() => {
    if (!hasInProgress) return;
    const id = window.setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 12_000);
    return () => window.clearInterval(id);
  }, [hasInProgress, router]);

  const filtered = useMemo(
    () =>
      filterRuns(active, {
        search,
        status,
        text: (c) => `${c.title} ${c.category}`,
        tone: (c) => toneOf(c.status),
      }),
    [active, search, status],
  );

  const { sorted, sort, toggle } = useSortedRows(filtered, {
    title: (c) => c.title,
    category: (c) => c.category,
    score: (c) => c.overallScore,
    created: (c) => c.createdAt,
  });

  function handleDelete() {
    const target = deleteTarget;
    if (!target) return;
    startTransition(async () => {
      try {
        await deleteProductConcept(target.id);
        toast.success(`"${target.title}" dihapus.`);
        setDeleteTarget(null);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Konsep gagal dihapus."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {concepts.length > 0 ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
          <RunLedger
            className="flex-1"
            counts={counts}
            noun="konsep produk"
            labels={LEDGER_LABELS}
            detail={`${goCount} keputusan GO, ${fromUspCount} dari USP Analyzer`}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link href="/research-hub/concept-lab/compare" />}>
              <GitCompare aria-hidden />
              Bandingkan konsep
            </Button>
            <Button
              variant={formOpen ? "outline" : "default"}
              onClick={() => setFormOpen((v) => !v)}
              aria-expanded={formOpen}
              aria-controls="concept-form"
            >
              {formOpen ? <X aria-hidden /> : <Plus aria-hidden />}
              {formOpen ? "Tutup form" : "Konsep baru"}
            </Button>
          </div>
        </div>
      ) : null}

      {hasInProgress ? (
        <p className="rh-meta" aria-live="polite">
          Ada konsep yang sedang dibuat atau divalidasi AI. Halaman ini
          diperbarui otomatis setiap beberapa detik.
        </p>
      ) : null}

      {formOpen ? (
        <NewConceptForm
          id="concept-form"
          onCancel={concepts.length > 0 ? () => setFormOpen(false) : undefined}
          onCreated={() => setFormOpen(false)}
        />
      ) : null}

      {concepts.length === 0 && !formOpen ? (
        <LabEmptyState
          icon={FlaskConical}
          title="Belum ada konsep produk"
          description="Buat konsep secara manual atau biarkan AI menyusunnya dari kategori. Konsep dari USP Analyzer otomatis membawa konteks riset."
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-3.5" aria-hidden />
              Konsep baru
            </Button>
          }
        />
      ) : null}

      {concepts.length > 0 ? (
        <section aria-label="Daftar konsep" className="flex flex-col gap-3">
          <ResearchFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Cari judul atau kategori…"
            status={status}
            onStatusChange={setStatus}
            statusCounts={counts}
            statusLabels={LEDGER_LABELS}
            resultCount={filtered.length}
            totalCount={active.length}
            onReset={() => {
              setSearch("");
              setStatus("all");
            }}
          >
            {archivedCount > 0 ? (
              <label
                htmlFor="concept-show-archived"
                className="text-muted-foreground flex items-center gap-2 text-sm"
              >
                <Checkbox
                  id="concept-show-archived"
                  checked={showArchived}
                  onCheckedChange={(v) => setShowArchived(!!v)}
                />
                Tampilkan arsip
                <span className="rh-num">{archivedCount}</span>
              </label>
            ) : null}
          </ResearchFilterBar>

          {sorted.length === 0 ? (
            <p className="rh-meta border-border rounded-xl border border-dashed px-5 py-8 text-center text-[13px]">
              {active.length === 0
                ? "Semua konsep sudah diarsipkan. Centang Tampilkan arsip untuk melihatnya."
                : "Tidak ada konsep yang cocok dengan filter ini."}
            </p>
          ) : (
            <ResearchTable maxHeight="70vh">
              <TableHeader sticky>
                <TableRow>
                  <SortableHead sortKey="title" sort={sort} onSort={toggle}>
                    Konsep
                  </SortableHead>
                  <SortableHead sortKey="category" sort={sort} onSort={toggle}>
                    Kategori
                  </SortableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <SortableHead sortKey="score" sort={sort} onSort={toggle} align="right">
                    Skor
                  </SortableHead>
                  <TableHead>Keputusan</TableHead>
                  <TableHead>Asal</TableHead>
                  <SortableHead sortKey="created" sort={sort} onSort={toggle}>
                    Dibuat
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
                        href={`/research-hub/concept-lab/${c.id}`}
                        className="text-foreground focus-visible:ring-ring rounded font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {c.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[14rem] truncate">
                      {c.category}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {PRODUCT_CONCEPT_MODE_LABELS[c.mode]}
                    </TableCell>
                    <TableCell>
                      <RunStatusBadge
                        tone={toneOf(c.status)}
                        label={PRODUCT_CONCEPT_STATUS_LABELS[c.status]}
                      />
                    </TableCell>
                    <TableCell className="rh-num text-right">
                      {c.overallScore != null ? (
                        Math.round(c.overallScore)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className={cn("font-medium", decisionClass(c.decision))}>
                      {c.decision ? (DECISION_LABEL[c.decision] ?? c.decision) : "—"}
                    </TableCell>
                    <TableCell>
                      {c.uspGapAnalysisId ? (
                        <Link
                          href={`/research-hub/usp-analyzer/${c.uspGapAnalysisId}`}
                          className="text-primary focus-visible:ring-ring rounded text-xs font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        >
                          USP Analyzer
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-xs">Concept Lab</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <time dateTime={c.createdAt} title={new Date(c.createdAt).toLocaleString("id-ID")}>
                        {formatRelativeTime(new Date(c.createdAt))}
                      </time>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={pending}
                        onClick={() => setDeleteTarget(c)}
                        aria-label={`Hapus "${c.title}"`}
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
        title={`Hapus konsep "${deleteTarget?.title ?? ""}"?`}
        description="Isi konsep, skor validasi, dan hasil generate AI ikut terhapus. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Hapus konsep"
        pending={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
