"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
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
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";

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

/** Pill status bergaya bento: emerald siap, amber berjalan, rose gagal. */
function StatusPill({ status }: { status: KeywordIntelStatus }) {
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
      {KEYWORD_INTEL_STATUS_LABELS[status]}
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

  const hasInProgress = queries.some((q) => isInProgress(q.status));
  const readyCount = queries.filter((q) => q.status === "READY").length;
  const runningCount = queries.filter((q) => isInProgress(q.status)).length;
  const totalKeywords = queries.reduce((sum, q) => sum + q.keywordCount, 0);
  const totalGaps = queries.reduce((sum, q) => sum + q.gapCount, 0);

  useEffect(() => {
    if (!hasInProgress) return;
    const id = window.setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 12_000);
    return () => window.clearInterval(id);
  }, [hasInProgress, router]);

  function handleCreate() {
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
        toast.success("Analisis keyword dimulai.");
        setFormOpen(false);
        setCategory("");
        setSeedKeyword("");
        router.push(`/research-hub/keyword-intel/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
      }
    });
  }

  function handleRefresh(id: string) {
    startTransition(async () => {
      try {
        await refreshKeywordIntelQuery(id);
        toast.success("Refresh dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Hapus analisis keyword ini?")) return;
    startTransition(async () => {
      try {
        await deleteKeywordIntelQuery(id);
        toast.success("Dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
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
              Total keyword
            </span>
            <span className="bento-value text-white dark:text-violet-950">
              {totalKeywords.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium text-violet-100/90 dark:text-violet-900/80">
              dari {queries.length} analisis kategori
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Analisis</span>
            <span className="bento-value">
              {queries.length.toLocaleString("id-ID")}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              {runningCount > 0
                ? `${runningCount} sedang berjalan`
                : "semua selesai diproses"}
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
              analisis berstatus siap
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
            <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
              Keyword gap
            </span>
            <span className="bento-value text-amber-900 dark:text-amber-300">
              {totalGaps.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium text-amber-800/70 dark:text-amber-300/70">
              peluang belum tergarap
            </span>
          </div>
        </div>
      ) : null}

      {hasInProgress ? (
        <div className={lab.entrance}>
          <JobProgressBar
            title="Analisis keyword berjalan"
            percent={40}
            stepLabel="Satu atau lebih query sedang mengumpulkan sinyal & menjalankan AI."
          />
          <p className="text-muted-foreground mt-1.5 px-1 text-xs">
            Halaman diperbarui otomatis setiap beberapa detik.
          </p>
        </div>
      ) : null}

      {/* Daftar analisis + form collapsible */}
      <section className={cn(lab.section, lab.entrance)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={lab.sectionTitle}>Analisis keyword</h2>
            <p className={lab.sectionDesc}>
              {queries.length === 0
                ? "Mulai dengan kategori produk pertama Anda di bawah."
                : `${queries.length} analisis · peluang, gap, dan copywriting dari marketplace & sinyal internal.`}
            </p>
          </div>
          {queries.length > 0 ? (
            <Button
              variant={formOpen ? "outline" : "default"}
              onClick={() => setFormOpen((v) => !v)}
            >
              {formOpen ? <X /> : <Plus />}
              {formOpen ? "Tutup" : "Analisis baru"}
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
                Analisis keyword baru
              </p>
              <p className="text-muted-foreground text-sm">
                Sistem mengumpulkan volume, gap, dan rekomendasi naming dari
                kategori yang Anda teliti.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_CATEGORY_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="bg-muted hover:bg-muted/80 rounded-full px-3 py-1 text-[11px] font-medium transition-colors duration-150 motion-reduce:transition-none"
                  onClick={() => setCategory(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="category">Kategori produk</Label>
                <Input
                  id="category"
                  placeholder="body serum brightening"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="seed">Seed keyword (opsional)</Label>
                <Input
                  id="seed"
                  placeholder="serum pemutih badan"
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
              <p className="text-muted-foreground text-xs">
                Pipeline sinyal & AI berjalan di background setelah dimulai.
              </p>
              <Button
                onClick={handleCreate}
                disabled={pending || !category.trim()}
              >
                {pending ? <RefreshCw className="animate-spin" /> : <Search />}
                {pending ? "Memproses…" : "Mulai analisis"}
              </Button>
            </div>
          </div>
        ) : null}

        {queries.length === 0 && !formOpen ? (
          <LabEmptyState
            icon={Search}
            title="Belum ada analisis keyword"
            description="Mulai dengan kategori produk yang ingin diteliti — sistem akan mengumpulkan volume, gap, dan rekomendasi naming."
            action={
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="size-3.5" aria-hidden />
                Analisis Baru
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
                  href={`/research-hub/keyword-intel/${q.id}`}
                  className="flex flex-1 flex-col gap-4 p-5 pb-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl"
                        aria-hidden
                      >
                        <Search className="size-4.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground truncate font-bold tracking-tight">
                          {q.category}
                        </p>
                        <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                          {q.seedKeyword ? (
                            <span className="truncate">
                              Seed: {q.seedKeyword} ·
                            </span>
                          ) : null}
                          {q.marketplace ? (
                            <>
                              <MarketplaceLogo
                                marketplace={q.marketplace}
                                className="size-3.5"
                              />
                              <span className="truncate">
                                {MARKETPLACE_LABELS[q.marketplace]}
                              </span>
                            </>
                          ) : (
                            <span className="truncate">Semua marketplace</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={q.status} />
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <CardStat
                      label="Keyword"
                      value={
                        q.keywordCount > 0
                          ? q.keywordCount.toLocaleString("id-ID")
                          : "—"
                      }
                    />
                    <CardStat
                      label="Gap"
                      value={
                        q.gapCount > 0 ? (
                          <span className="text-amber-700 dark:text-amber-300">
                            {q.gapCount.toLocaleString("id-ID")}
                          </span>
                        ) : (
                          "—"
                        )
                      }
                    />
                    <CardStat
                      label="Sinyal"
                      value={
                        q.signalStats
                          ? q.signalStats.total.toLocaleString("id-ID")
                          : "—"
                      }
                    />
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

                <div className="border-border/60 flex items-center justify-end gap-1 border-t px-3 py-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending || isInProgress(q.status)}
                    onClick={() => handleRefresh(q.id)}
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={pending}
                    onClick={() => handleDelete(q.id)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
