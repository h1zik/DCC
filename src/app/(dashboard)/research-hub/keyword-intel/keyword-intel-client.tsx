"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { KeywordIntelStatus, ResearchMarketplace } from "@prisma/client";
import { Plus, RefreshCw, Search, Trash2 } from "lucide-react";
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
  KEYWORD_INTEL_STATUS_LABELS,
  MARKETPLACE_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
import { DEFAULT_CATEGORY_PRESETS } from "@/lib/research/keyword-intel/keyword-source-config-types";
import type { KeywordSourceConfig } from "@/lib/research/keyword-intel/keyword-source-config-types";
import type { KeywordSignalStats } from "@/lib/research/keyword-intel/keyword-signal-types";
import {
  hub,
  ResearchHubEmptyState,
  ResearchHubSection,
  ResearchHubStatChip,
} from "@/components/research-hub/research-hub-primitives";
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

function statusChipTone(
  status: KeywordIntelStatus,
): "neutral" | "success" | "warning" | "primary" {
  switch (status) {
    case "READY":
      return "success";
    case "FAILED":
      return "warning";
    case "COLLECTING":
    case "ANALYZING":
    case "PENDING":
      return "warning";
    default:
      return "neutral";
  }
}

function isInProgress(status: KeywordIntelStatus) {
  return (
    status === "COLLECTING" ||
    status === "ANALYZING" ||
    status === "PENDING"
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [seedKeyword, setSeedKeyword] = useState("");
  const [sourceConfig, setSourceConfig] =
    useState<KeywordSourceConfig>(defaultSourceConfig);

  const hasInProgress = queries.some((q) => isInProgress(q.status));
  const readyCount = queries.filter((q) => q.status === "READY").length;
  const totalKeywords = queries.reduce((sum, q) => sum + q.keywordCount, 0);
  const totalGaps = queries.reduce((sum, q) => sum + q.gapCount, 0);

  useEffect(() => {
    if (!hasInProgress) return;
    const id = window.setInterval(() => router.refresh(), 12_000);
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
        setDialogOpen(false);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <ResearchHubStatChip
            label="Analisis"
            value={queries.length.toLocaleString("id-ID")}
            tone="primary"
          />
          <ResearchHubStatChip
            label="Siap"
            value={readyCount.toLocaleString("id-ID")}
            tone="success"
          />
          <ResearchHubStatChip
            label="Total keyword"
            value={totalKeywords.toLocaleString("id-ID")}
          />
          <ResearchHubStatChip
            label="Gap"
            value={totalGaps.toLocaleString("id-ID")}
            tone={totalGaps > 0 ? "warning" : "neutral"}
          />
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="mr-1.5 size-3.5" aria-hidden />
                Analisis Baru
              </Button>
            }
          />
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Analisis Keyword Baru</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_CATEGORY_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="bg-muted hover:bg-muted/80 rounded-full px-2.5 py-0.5 text-[10px] transition-colors duration-150 motion-reduce:transition-none"
                    onClick={() => setCategory(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="category">Kategori produk</Label>
                <Input
                  id="category"
                  placeholder="body serum brightening"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="seed">Seed keyword (opsional)</Label>
                <Input
                  id="seed"
                  placeholder="serum pemutih badan"
                  value={seedKeyword}
                  onChange={(e) => setSeedKeyword(e.target.value)}
                />
              </div>
              <KeywordSourceConfigPicker
                config={sourceConfig}
                onChange={setSourceConfig}
              />
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={pending || !category.trim()}
              >
                {pending ? "Memproses…" : "Mulai Analisis"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {hasInProgress ? (
        <div className={hub.entrance}>
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

      <ResearchHubSection
        title="Analisis Keyword"
        description="Peluang, gap, dan copywriting dari marketplace & sinyal internal."
      >
        {queries.length === 0 ? (
          <ResearchHubEmptyState
            icon={Search}
            title="Belum ada analisis keyword"
            description="Mulai dengan kategori produk yang ingin diteliti — sistem akan mengumpulkan volume, gap, dan rekomendasi naming."
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="size-3.5" aria-hidden />
                Analisis Baru
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
                      href={`/research-hub/keyword-intel/${q.id}`}
                      className="hover:text-primary text-base font-semibold transition-colors duration-150 motion-reduce:transition-none"
                    >
                      {q.category}
                    </Link>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {q.seedKeyword ? `Seed: ${q.seedKeyword} · ` : ""}
                      {q.marketplace
                        ? MARKETPLACE_LABELS[q.marketplace]
                        : "Semua marketplace"}
                    </p>
                  </div>
                  <ResearchHubStatChip
                    label="Status"
                    value={KEYWORD_INTEL_STATUS_LABELS[q.status]}
                    tone={statusChipTone(q.status)}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <ResearchHubStatChip
                    label="Keyword"
                    value={
                      q.keywordCount > 0
                        ? q.keywordCount.toLocaleString("id-ID")
                        : "—"
                    }
                    tone="primary"
                  />
                  {q.gapCount > 0 ? (
                    <ResearchHubStatChip
                      label="Gap"
                      value={q.gapCount.toLocaleString("id-ID")}
                      tone="warning"
                    />
                  ) : null}
                  {q.signalStats ? (
                    <ResearchHubStatChip
                      label="Sinyal"
                      value={q.signalStats.total.toLocaleString("id-ID")}
                    />
                  ) : null}
                  <ResearchHubStatChip
                    label="Dibuat"
                    value={formatRelativeTime(new Date(q.createdAt))}
                  />
                </div>

                {q.dataNotice ? (
                  <p className="text-sky-800 dark:text-sky-200 mt-2 text-xs">
                    {q.dataNotice}
                  </p>
                ) : null}

                {q.errorMessage ? (
                  <p className="text-amber-700 dark:text-amber-300 mt-2 text-xs">
                    {q.errorMessage}
                  </p>
                ) : null}

                <div className="mt-3 flex gap-1 border-t border-border/40 pt-3">
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
        )}
      </ResearchHubSection>
    </div>
  );
}
