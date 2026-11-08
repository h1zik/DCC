"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { KeywordIntelStatus, ResearchMarketplace } from "@prisma/client";
import { Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  createKeywordIntelQuery,
  deleteKeywordIntelQuery,
  refreshKeywordIntelQuery,
} from "@/actions/research-keyword-intel";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  KeywordSourceConfigPicker,
  validateKeywordConfigClient,
} from "@/components/research-hub/keyword-source-config-picker";
import { Button } from "@/components/ui/button";
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
  KEYWORD_INTEL_STATUS_LABELS,
  MARKETPLACE_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
import { DEFAULT_CATEGORY_PRESETS } from "@/lib/research/keyword-intel/keyword-source-config-types";
import type { KeywordSourceConfig } from "@/lib/research/keyword-intel/keyword-source-config-types";
import type { KeywordSignalStats } from "@/lib/research/keyword-intel/keyword-signal-types";
import { lab, LabEmptyState } from "@/components/lab/lab-primitives";
import { MarketplaceLogo } from "@/components/research-hub/marketplace-logo";
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
import { ResearchFilterEmpty } from "@/components/research-hub/kit/research-section";

export type KeywordQueryRow = {
  id: string;
  category: string;
  seedKeyword: string | null;
  marketplace: ResearchMarketplace | null;
  status: KeywordIntelStatus;
  dataNotice: string | null;
  signalStats: KeywordSignalStats | null;
  keywordCount: number;
  gapCount: number;
  createdAt: string;
  errorMessage: string | null;
};

function isInProgress(status: KeywordIntelStatus) {
  return (
    status === "COLLECTING" ||
    status === "ANALYZING" ||
    status === "PENDING"
  );
}

function toneOf(status: KeywordIntelStatus): RunTone {
  if (status === "READY") return "ready";
  if (status === "FAILED") return "failed";
  if (isInProgress(status)) return "running";
  return "idle";
}

const LEDGER_LABELS = { running: "Sedang dianalisis" } as const;

export function KeywordIntelClient({
  queries,
  defaultSourceConfig,
}: {
  queries: KeywordQueryRow[];
  defaultSourceConfig: KeywordSourceConfig;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(queries.length === 0);
  const [category, setCategory] = useState("");
  const [seedKeyword, setSeedKeyword] = useState("");
  const [sourceConfig, setSourceConfig] =
    useState<KeywordSourceConfig>(defaultSourceConfig);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RunToneFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<KeywordQueryRow | null>(null);

  const hasInProgress = queries.some((q) => isInProgress(q.status));
  const totalKeywords = queries.reduce((sum, q) => sum + q.keywordCount, 0);
  const totalGaps = queries.reduce((sum, q) => sum + q.gapCount, 0);
  const counts = useMemo(() => countRunTones(queries, (q) => toneOf(q.status)), [queries]);

  useEffect(() => {
    if (!hasInProgress) return;
    const id = window.setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 12_000);
    return () => window.clearInterval(id);
  }, [hasInProgress, router]);

  const filtered = useMemo(
    () =>
      filterRuns(queries, {
        search,
        status,
        text: (q) =>
          `${q.category} ${q.seedKeyword ?? ""} ${q.marketplace ? MARKETPLACE_LABELS[q.marketplace] : ""}`,
        tone: (q) => toneOf(q.status),
      }),
    [queries, search, status],
  );

  const { sorted, sort, toggle } = useSortedRows(filtered, {
    category: (q) => q.category,
    keywords: (q) => q.keywordCount,
    gaps: (q) => q.gapCount,
    signals: (q) => q.signalStats?.total ?? null,
    created: (q) => q.createdAt,
  });

  function handleCreate() {
    if (!category.trim()) {
      toast.error("Isi kategori produk dulu, mis. \"body serum brightening\".");
      return;
    }
    const validationError = validateKeywordConfigClient(sourceConfig);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    startTransition(async () => {
      try {
        const result = await createKeywordIntelQuery({
          category,
          seedKeyword: seedKeyword.trim() || undefined,
          marketplace: ResearchMarketplace.SHOPEE,
          sourceConfig: sourceConfig as Record<string, unknown>,
        });
        toast.success("Analisis dimulai. Sinyal dikumpulkan di background.");
        setFormOpen(false);
        setCategory("");
        setSeedKeyword("");
        router.push(`/research-hub/keyword-intel/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Analisis gagal dimulai."));
      }
    });
  }

  function handleRefresh(q: KeywordQueryRow) {
    startTransition(async () => {
      try {
        await refreshKeywordIntelQuery(q.id);
        toast.success(`"${q.category}" dianalisis ulang.`);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menganalisis ulang."));
      }
    });
  }

  function handleDelete() {
    const target = deleteTarget;
    if (!target) return;
    startTransition(async () => {
      try {
        await deleteKeywordIntelQuery(target.id);
        toast.success(`"${target.category}" dihapus.`);
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
            noun="analisis keyword"
            labels={LEDGER_LABELS}
            detail={`${totalKeywords.toLocaleString("id-ID")} keyword, ${totalGaps.toLocaleString("id-ID")} gap`}
          />
          <Button
            variant={formOpen ? "outline" : "default"}
            onClick={() => setFormOpen((v) => !v)}
            aria-expanded={formOpen}
            aria-controls="ki-form"
          >
            {formOpen ? <X aria-hidden /> : <Plus aria-hidden />}
            {formOpen ? "Tutup form" : "Analisis baru"}
          </Button>
        </div>
      ) : null}

      {hasInProgress ? (
        <p className="rh-meta" aria-live="polite">
          Ada analisis yang masih mengumpulkan sinyal. Halaman ini diperbarui
          otomatis setiap beberapa detik.
        </p>
      ) : null}

      {formOpen ? (
        <section
          id="ki-form"
          aria-labelledby="ki-form-title"
          className={cn(
            lab.panel,
            "grid gap-5",
            "animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none",
          )}
        >
          <div className="space-y-1">
            <h2 id="ki-form-title" className="rh-section-title">
              Analisis keyword baru
            </h2>
            <p className="rh-lede">
              Sistem mengumpulkan volume, gap, dan rekomendasi naming dari
              kategori yang Anda teliti.
            </p>
          </div>
          <div className="grid gap-2">
            <p id="ki-presets-label" className="rh-meta">
              Contoh kategori
            </p>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-labelledby="ki-presets-label"
            >
              {DEFAULT_CATEGORY_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="bg-muted hover:bg-muted/80 focus-visible:ring-ring rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                  onClick={() => setCategory(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ki-category">Kategori produk</Label>
              <Input
                id="ki-category"
                placeholder="Mis. body serum brightening"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ki-seed">Seed keyword (opsional)</Label>
              <Input
                id="ki-seed"
                placeholder="Mis. serum pemutih badan"
                value={seedKeyword}
                onChange={(e) => setSeedKeyword(e.target.value)}
                disabled={pending}
              />
            </div>
          </div>
          <KeywordSourceConfigPicker
            config={sourceConfig}
            onChange={setSourceConfig}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="rh-meta">
              Pengumpulan sinyal dan analisis AI berjalan di background setelah
              dimulai.
            </p>
            <div className="flex items-center gap-3">
              {queries.length > 0 ? (
                <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={pending}>
                  Batal
                </Button>
              ) : null}
              <Button onClick={handleCreate} disabled={pending}>
                {pending ? (
                  <RefreshCw className="animate-spin" aria-hidden />
                ) : (
                  <Search aria-hidden />
                )}
                {pending ? "Memulai…" : "Mulai analisis"}
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {queries.length === 0 && !formOpen ? (
        <LabEmptyState
          icon={Search}
          title="Belum ada analisis keyword"
          description="Mulai dari kategori produk yang ingin diteliti. Sistem mengumpulkan volume, gap, dan rekomendasi naming."
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-3.5" aria-hidden />
              Analisis baru
            </Button>
          }
        />
      ) : null}

      {queries.length > 0 ? (
        <section aria-label="Daftar analisis keyword" className="flex flex-col gap-3">
          <ResearchFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Cari kategori atau seed keyword…"
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
            <ResearchFilterEmpty>Tidak ada analisis yang cocok dengan filter ini.</ResearchFilterEmpty>
          ) : (
            <ResearchTable maxHeight="70vh">
              <TableHeader sticky>
                <TableRow>
                  <SortableHead sortKey="category" sort={sort} onSort={toggle}>
                    Kategori
                  </SortableHead>
                  <TableHead>Marketplace</TableHead>
                  <TableHead>Status</TableHead>
                  <SortableHead sortKey="keywords" sort={sort} onSort={toggle} align="right">
                    Keyword
                  </SortableHead>
                  <SortableHead sortKey="gaps" sort={sort} onSort={toggle} align="right">
                    Gap
                  </SortableHead>
                  <SortableHead sortKey="signals" sort={sort} onSort={toggle} align="right">
                    Sinyal
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
                    <TableRow key={q.id}>
                      <TableCell className="max-w-[22rem] whitespace-normal">
                        <Link
                          href={`/research-hub/keyword-intel/${q.id}`}
                          className="text-foreground focus-visible:ring-ring rounded font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        >
                          {q.category}
                        </Link>
                        {q.seedKeyword ? (
                          <p className="rh-meta mt-0.5 truncate">
                            Seed: {q.seedKeyword}
                          </p>
                        ) : null}
                        {tone === "failed" && q.errorMessage ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-rose-700 dark:text-rose-300">
                            {q.errorMessage}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {q.marketplace ? (
                          <span className="inline-flex items-center gap-1.5">
                            <MarketplaceLogo marketplace={q.marketplace} className="size-4" />
                            {MARKETPLACE_LABELS[q.marketplace]}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Semua</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <RunStatusBadge tone={tone} label={KEYWORD_INTEL_STATUS_LABELS[q.status]} />
                      </TableCell>
                      <TableCell className="rh-num text-right">
                        {q.keywordCount > 0 ? (
                          q.keywordCount.toLocaleString("id-ID")
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="rh-num text-right">
                        {q.gapCount > 0 ? (
                          q.gapCount.toLocaleString("id-ID")
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="rh-num text-right">
                        {q.signalStats ? (
                          q.signalStats.total.toLocaleString("id-ID")
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
                            disabled={pending || isInProgress(q.status)}
                            onClick={() => handleRefresh(q)}
                            aria-label={`Analisis ulang "${q.category}"`}
                            title="Analisis ulang"
                          >
                            <RefreshCw aria-hidden />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            disabled={pending}
                            onClick={() => setDeleteTarget(q)}
                            aria-label={`Hapus "${q.category}"`}
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
        title={`Hapus analisis "${deleteTarget?.category ?? ""}"?`}
        description={`${(deleteTarget?.keywordCount ?? 0).toLocaleString("id-ID")} keyword, ${(deleteTarget?.gapCount ?? 0).toLocaleString("id-ID")} gap, dan rekomendasi copywriting-nya ikut terhapus. Tindakan ini tidak bisa dibatalkan.`}
        confirmLabel="Hapus analisis"
        pending={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
