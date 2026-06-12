"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { BarChart3, Plus, RefreshCw, Trash2 } from "lucide-react";
import { UspGapStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  createUspGapAnalysis,
  deleteUspGapAnalysis,
  refreshUspGapAnalysis,
} from "@/actions/research-usp-gap";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { USP_GAP_STATUS_LABELS } from "@/lib/research/labels";
import type { AvailableContextModules } from "@/lib/research/usp-gap/gather-context";
import { cn } from "@/lib/utils";

export type UspAnalysisRow = {
  id: string;
  category: string;
  status: UspGapStatus;
  differentiationScore: number | null;
  uspCount: number;
  createdAt: string;
  errorMessage: string | null;
  contextModules: {
    reviewIntel?: boolean;
    competitor?: boolean;
    trendRadar?: boolean;
    keywordIntel?: boolean;
    socialListening?: boolean;
  };
};

export type AvailableModules = AvailableContextModules;

function statusTone(status: UspGapStatus) {
  switch (status) {
    case "READY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "FAILED":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "GATHERING":
    case "ANALYZING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

const MODULE_LABELS: Record<keyof AvailableModules, string> = {
  reviewIntel: "Review Intel",
  competitor: "Competitor Tracker",
  trendRadar: "Trend Radar",
  keywordIntel: "Keyword Intel",
  socialListening: "Social Listening",
};

export function UspAnalyzerClient({
  analyses,
  availableModules,
}: {
  analyses: UspAnalysisRow[];
  availableModules: AvailableModules;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [modules, setModules] = useState<AvailableModules>({
    reviewIntel: availableModules.reviewIntel,
    competitor: availableModules.competitor,
    trendRadar: availableModules.trendRadar,
    keywordIntel: availableModules.keywordIntel,
    socialListening: availableModules.socialListening,
  });

  const hasInProgress = analyses.some(
    (a) =>
      a.status === "GATHERING" ||
      a.status === "ANALYZING" ||
      a.status === "PENDING",
  );

  useEffect(() => {
    if (!hasInProgress) return;
    const id = window.setInterval(() => router.refresh(), 12_000);
    return () => window.clearInterval(id);
  }, [hasInProgress, router]);

  function toggleModule(key: keyof AvailableModules) {
    if (!availableModules[key]) return;
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleCreate() {
    if (!category.trim()) {
      toast.error("Masukkan kategori produk.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createUspGapAnalysis({
          category,
          contextModules: modules,
        });
        toast.success("Analisis USP selesai.");
        setDialogOpen(false);
        setCategory("");
        router.push(`/research-hub/usp-analyzer/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menjalankan analisis."));
      }
    });
  }

  function handleRefresh(id: string) {
    startTransition(async () => {
      try {
        await refreshUspGapAnalysis(id);
        toast.success("Refresh analisis dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteUspGapAnalysis(id);
        toast.success("Analisis dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Agregasi data modul 1–5 untuk gap matrix, positioning, dan kandidat USP.
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="mr-1.5 size-4" />
                Analisis Baru
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Analisis USP & Gap Baru</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="usp-category">Kategori produk</Label>
                <Input
                  id="usp-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="body serum brightening"
                />
              </div>
              <div className="space-y-2">
                <Label>Sumber data</Label>
                <div className="space-y-2">
                  {(Object.keys(MODULE_LABELS) as (keyof AvailableModules)[]).map(
                    (key) => (
                      <label
                        key={key}
                        className={cn(
                          "flex items-center gap-2 text-sm",
                          !availableModules[key] && "opacity-50",
                        )}
                      >
                        <Checkbox
                          checked={modules[key] && availableModules[key]}
                          disabled={!availableModules[key]}
                          onCheckedChange={() => toggleModule(key)}
                        />
                        {MODULE_LABELS[key]}
                        {!availableModules[key] ? " (belum ada data)" : ""}
                      </label>
                    ),
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={pending || !category.trim()}
              >
                Jalankan Analisis
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border-border/60 overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kategori</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">USP</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {analyses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                  <BarChart3 className="mx-auto mb-2 size-8 opacity-40" />
                  Belum ada analisis USP. Buat analisis untuk kategori produk.
                </TableCell>
              </TableRow>
            ) : (
              analyses.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link
                      href={`/research-hub/usp-analyzer/${a.id}`}
                      className="font-medium hover:underline"
                    >
                      {a.category}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        statusTone(a.status),
                      )}
                    >
                      {USP_GAP_STATUS_LABELS[a.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {a.uspCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {a.differentiationScore != null
                      ? Math.round(a.differentiationScore)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        disabled={pending}
                        onClick={() => handleRefresh(a.id)}
                      >
                        <RefreshCw className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-rose-600"
                        disabled={pending}
                        onClick={() => handleDelete(a.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
