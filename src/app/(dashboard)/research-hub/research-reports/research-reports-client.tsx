"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FileText, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import {
  ResearchReportStatus,
  ResearchReportType,
} from "@prisma/client";
import { toast } from "sonner";
import {
  createResearchReport,
  deleteResearchReport,
  refreshResearchReport,
} from "@/actions/research-reports";
import { suggestUspContextSources } from "@/actions/research-usp-gap";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  defaultReportModules,
  ReportModuleSummaryChips,
  ResearchReportSourcePicker,
  reportSelectionsToConfig,
  type ReportAvailableModules,
  type ReportModuleToggles,
  type ReportSourceSelections,
} from "@/components/research-hub/research-report-source-picker";
import type { ReportSourceOptions } from "@/lib/research/reports/list-report-source-options";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RESEARCH_REPORT_STATUS_LABELS,
  RESEARCH_REPORT_TYPE_LABELS,
} from "@/lib/research/labels";
import { cn } from "@/lib/utils";

export type ReportRow = {
  id: string;
  title: string;
  type: ResearchReportType;
  status: ResearchReportStatus;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  errorMessage: string | null;
};

function statusTone(status: ResearchReportStatus) {
  switch (status) {
    case "READY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "FAILED":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "GENERATING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function ResearchReportsClient({
  reports,
  latestWeeklyId,
  options,
  availableModules,
}: {
  reports: ReportRow[];
  latestWeeklyId: string | null;
  options: ReportSourceOptions;
  availableModules: ReportAvailableModules;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [suggestPending, setSuggestPending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reportType, setReportType] = useState<ResearchReportType>(
    ResearchReportType.CUSTOM,
  );
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [competitorId, setCompetitorId] = useState("");
  const [digestId, setDigestId] = useState("");
  const [modules, setModules] = useState<ReportModuleToggles>(() =>
    defaultReportModules(availableModules),
  );
  const [selections, setSelections] = useState<ReportSourceSelections>({});

  const hasInProgress = reports.some(
    (r) => r.status === "GENERATING" || r.status === "PENDING",
  );

  const showModulePickers =
    reportType === ResearchReportType.CUSTOM ||
    reportType === ResearchReportType.CATEGORY_DEEP_DIVE;

  useEffect(() => {
    if (!hasInProgress) return;
    const id = window.setInterval(() => router.refresh(), 12_000);
    return () => window.clearInterval(id);
  }, [hasInProgress, router]);

  function resetDialog() {
    setTitle("");
    setCategory("");
    setCompetitorId("");
    setDigestId("");
    setModules(defaultReportModules(availableModules));
    setSelections({});
  }

  function handleSuggest() {
    if (!category.trim()) {
      toast.error("Isi kategori dulu untuk saran sumber.");
      return;
    }
    setSuggestPending(true);
    startTransition(async () => {
      try {
        const suggested = await suggestUspContextSources(category.trim());
        setSelections((prev) => ({
          ...prev,
          reviewSourceIds: suggested.reviewSourceIds,
          competitorIds: suggested.competitorIds,
          trendDigestId: suggested.trendDigestId ?? undefined,
          keywordQueryId: suggested.keywordQueryId ?? undefined,
          socialMonitorId: suggested.socialMonitorId ?? undefined,
        }));
        toast.success("Saran sumber data diterapkan.");
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengambil saran."));
      } finally {
        setSuggestPending(false);
      }
    });
  }

  function toggleModule(key: keyof ReportModuleToggles) {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleCreate() {
    startTransition(async () => {
      try {
        const config: Record<string, unknown> = {};
        if (reportType === ResearchReportType.CUSTOM) {
          config.modules = modules;
          if (category) config.category = category;
        }
        if (reportType === ResearchReportType.CATEGORY_DEEP_DIVE) {
          if (!category.trim()) {
            toast.error("Isi kategori.");
            return;
          }
          config.category = category;
          config.modules = modules;
        }
        if (reportType === ResearchReportType.COMPETITOR_BATTLE) {
          if (!competitorId) {
            toast.error("Pilih kompetitor.");
            return;
          }
          config.competitorId = competitorId;
        }
        if (reportType === ResearchReportType.TREND_BRIEF && digestId) {
          config.digestId = digestId;
        }

        if (showModulePickers) {
          const picked = reportSelectionsToConfig(modules, selections);
          if (Object.keys(picked).length > 0) config.sources = picked;
        }

        const result = await createResearchReport({
          type: reportType,
          title: title || undefined,
          config,
        });
        toast.success("Laporan sedang dibuat.");
        setDialogOpen(false);
        resetDialog();
        router.push(`/research-hub/research-reports/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat laporan."));
      }
    });
  }

  function handleRefresh(id: string) {
    startTransition(async () => {
      try {
        await refreshResearchReport(id);
        toast.success("Refresh dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteResearchReport(id);
        toast.success("Laporan dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="space-y-4">
      {latestWeeklyId ? (
        <div className="border-primary/30 bg-primary/5 rounded-lg border px-4 py-3 text-sm">
          Laporan mingguan terbaru:{" "}
          <Link
            href={`/research-hub/research-reports/${latestWeeklyId}`}
            className="text-primary font-medium hover:underline"
          >
            Buka laporan
          </Link>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetDialog();
          }}
        >
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="mr-1.5 size-4" />
                Buat Laporan
              </Button>
            }
          />
          <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="border-border/60 space-y-1 border-b px-6 py-5">
              <DialogTitle>Buat Laporan Riset</DialogTitle>
              <DialogDescription>
                Pilih modul sumber dan record spesifik — kosongkan untuk
                auto-suggest berdasarkan kategori.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="space-y-2">
                <Label>Tipe laporan</Label>
                <Select
                  value={reportType}
                  onValueChange={(v) => v && setReportType(v as ResearchReportType)}
                >
                  <SelectTrigger />
                  <SelectContent>
                    {(Object.keys(RESEARCH_REPORT_TYPE_LABELS) as ResearchReportType[])
                      .filter((t) => t !== "WEEKLY")
                      .map((t) => (
                        <SelectItem key={t} value={t}>
                          {RESEARCH_REPORT_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Judul (opsional)</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              {reportType === "COMPETITOR_BATTLE" && (
                <div className="space-y-2">
                  <Label>Kompetitor</Label>
                  <Select
                    value={competitorId}
                    onValueChange={(v) => v && setCompetitorId(v)}
                  >
                    <SelectTrigger />
                    <SelectContent>
                      {options.competitors.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label} — {c.meta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {reportType === "TREND_BRIEF" && (
                <div className="space-y-2">
                  <Label>Digest tren (opsional)</Label>
                  <Select value={digestId} onValueChange={(v) => v && setDigestId(v)}>
                    <SelectTrigger />
                    <SelectContent>
                      {options.digests.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.label} · {d.meta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {showModulePickers && (
                <>
                  <section className="border-border/60 space-y-3 rounded-xl border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">1. Kategori</p>
                        <p className="text-muted-foreground text-xs">
                          Dipakai untuk auto-suggest sumber data.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={suggestPending || pending}
                        onClick={handleSuggest}
                      >
                        <Sparkles className="mr-1.5 size-3.5" />
                        Saran
                      </Button>
                    </div>
                    <Input
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="Contoh: lip cream, moisturizer"
                    />
                  </section>

                  <section className="space-y-3">
                    <p className="text-sm font-medium">2. Sumber modul</p>
                    <ResearchReportSourcePicker
                      options={options}
                      available={availableModules}
                      modules={modules}
                      selections={selections}
                      onToggleModule={toggleModule}
                      onSelectionsChange={setSelections}
                    />
                  </section>
                </>
              )}
            </div>

            <DialogFooter className="border-border/60 flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:justify-between">
              <ReportModuleSummaryChips
                modules={modules}
                available={availableModules}
              />
              <Button onClick={handleCreate} disabled={pending}>
                Generate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border-border/60 overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Laporan</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Periode</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                  <FileText className="mx-auto mb-2 size-8 opacity-40" />
                  Belum ada laporan riset.
                </TableCell>
              </TableRow>
            ) : (
              reports.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/research-hub/research-reports/${r.id}`}
                      className="font-medium hover:underline"
                    >
                      {r.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">
                    {RESEARCH_REPORT_TYPE_LABELS[r.type]}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        statusTone(r.status),
                      )}
                    >
                      {RESEARCH_REPORT_STATUS_LABELS[r.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {r.periodStart && r.periodEnd
                      ? `${r.periodStart.slice(0, 10)} – ${r.periodEnd.slice(0, 10)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        disabled={pending}
                        onClick={() => handleRefresh(r.id)}
                      >
                        <RefreshCw className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-rose-600"
                        disabled={pending}
                        onClick={() => handleDelete(r.id)}
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
