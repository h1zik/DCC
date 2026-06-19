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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  KEYWORD_INTEL_STATUS_LABELS,
  MARKETPLACE_LABELS,
} from "@/lib/research/labels";
import { DEFAULT_CATEGORY_PRESETS } from "@/lib/research/keyword-intel/keyword-source-config-types";
import type { KeywordSourceConfig } from "@/lib/research/keyword-intel/keyword-source-config-types";
import type { KeywordSignalStats } from "@/lib/research/keyword-intel/keyword-signal-types";
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

function statusTone(status: KeywordIntelStatus) {
  switch (status) {
    case "READY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "FAILED":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "COLLECTING":
    case "ANALYZING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground";
  }
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

  const hasInProgress = queries.some(
    (q) =>
      q.status === "COLLECTING" ||
      q.status === "ANALYZING" ||
      q.status === "PENDING",
  );

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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {queries.length} analisis keyword
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="size-4" aria-hidden />
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
                    className="bg-muted hover:bg-muted/80 rounded-full px-2 py-0.5 text-[10px]"
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

      {queries.length === 0 ? (
        <div className="border-border/70 flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Search className="text-muted-foreground size-10" aria-hidden />
          <p className="text-muted-foreground text-sm">
            Belum ada analisis. Mulai dengan kategori produk yang ingin diteliti.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kategori</TableHead>
                <TableHead>KW / Gap</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queries.map((q) => (
                <TableRow key={q.id}>
                  <TableCell>
                    <Link
                      href={`/research-hub/keyword-intel/${q.id}`}
                      className="font-medium hover:underline"
                    >
                      {q.category}
                    </Link>
                    {q.seedKeyword ? (
                      <p className="text-muted-foreground text-xs">
                        seed: {q.seedKeyword}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {q.keywordCount || "—"}
                    {q.gapCount > 0 ? ` / ${q.gapCount} gap` : ""}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        statusTone(q.status),
                      )}
                    >
                      {KEYWORD_INTEL_STATUS_LABELS[q.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRefresh(q.id)}
                        disabled={pending}
                        title="Refresh"
                      >
                        <RefreshCw className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(q.id)}
                        disabled={pending}
                        title="Hapus"
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
    </div>
  );
}
