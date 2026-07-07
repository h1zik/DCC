"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
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
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
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
  RESEARCH_REPORT_STATUS_LABELS,
  RESEARCH_REPORT_TYPE_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
import type { SelectItemDef } from "@/lib/select-option-items";
import {
  hub,
  ResearchHubEmptyState,
  ResearchHubSection,
  ResearchHubStatChip,
} from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";

const REPORT_TYPE_ITEMS: SelectItemDef[] = (
  Object.keys(RESEARCH_REPORT_TYPE_LABELS) as ResearchReportType[]
)
  .filter((t) => t !== "WEEKLY")
  .map((t) => ({ value: t, label: RESEARCH_REPORT_TYPE_LABELS[t] }));

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

function statusChipTone(
  status: ResearchReportStatus,
): "neutral" | "success" | "warning" | "primary" {
  switch (status) {
    case "READY":
      return "success";
    case "FAILED":
      return "warning";
    case "GENERATING":
    case "PENDING":
      return "warning";
    default:
      return "neutral";
  }
}

function isInProgress(status: ResearchReportStatus) {
  return status === "GENERATING" || status === "PENDING";
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

  const hasInProgress = reports.some((r) => isInProgress(r.status));
  const readyCount = reports.filter((r) => r.status === "READY").length;

  const competitorItems = useMemo(
    (): SelectItemDef[] =>
      options.competitors.map((c) => ({
        value: c.id,
        label: `${c.label} — ${c.meta}`,
      })),
    [options.competitors],
  );

  const digestItems = useMemo(
    (): SelectItemDef[] =>
      options.digests.map((d) => ({
        value: d.id,
        label: `${d.label} · ${d.meta}`,
      })),
    [options.digests],
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
    if (!confirm("Hapus laporan ini?")) return;
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
    <div className="flex flex-col gap-6">
      {latestWeeklyId ? (
        <div
          className={cn(
            hub.nestedPanel,
            hub.entrance,
            "border-primary/30 bg-primary/5 text-sm",
          )}
        >
          Laporan mingguan terbaru:{" "}
          <Link
            href={`/research-hub/research-reports/${latestWeeklyId}`}
            className="text-primary font-medium hover:underline"
          >
            Buka laporan →
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <ResearchHubStatChip
            label="Laporan"
            value={reports.length.toLocaleString("id-ID")}
            tone="primary"
          />
          <ResearchHubStatChip
            label="Siap"
            value={readyCount.toLocaleString("id-ID")}
            tone="success"
          />
        </div>

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
                <Plus className="mr-1.5 size-3.5" aria-hidden />
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
                  items={REPORT_TYPE_ITEMS}
                  onValueChange={(v) => v && setReportType(v as ResearchReportType)}
                >
                  <SelectTrigger />
                  <SelectContent>
                    {REPORT_TYPE_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
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
                    items={competitorItems}
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
                  <Select
                    value={digestId}
                    items={digestItems}
                    onValueChange={(v) => v && setDigestId(v)}
                  >
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
                  <section className={cn(hub.nestedPanel, "space-y-3")}>
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
                        <Sparkles className="mr-1.5 size-3.5" aria-hidden />
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

      {hasInProgress ? (
        <div className={hub.entrance}>
          <JobProgressBar
            title="Generate laporan berjalan"
            percent={50}
            stepLabel="Mengagregasi data modul riset lalu menulis section laporan dengan AI."
          />
        </div>
      ) : null}

      <ResearchHubSection
        title="Laporan Riset"
        description="Weekly digest, deep dive, battle card — export PDF & share link."
      >
        {reports.length === 0 ? (
          <ResearchHubEmptyState
            icon={FileText}
            title="Belum ada laporan riset"
            description="Buat laporan custom atau deep dive — pilih sumber modul spesifik agar isi laporan lebih terbukti."
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="size-3.5" aria-hidden />
                Buat Laporan
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {reports.map((r, index) => (
              <div
                key={r.id}
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
                      href={`/research-hub/research-reports/${r.id}`}
                      className="hover:text-primary line-clamp-2 text-base font-semibold transition-colors duration-150 motion-reduce:transition-none"
                    >
                      {r.title}
                    </Link>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {RESEARCH_REPORT_TYPE_LABELS[r.type]}
                    </p>
                  </div>
                  <ResearchHubStatChip
                    label="Status"
                    value={RESEARCH_REPORT_STATUS_LABELS[r.status]}
                    tone={statusChipTone(r.status)}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {r.periodStart && r.periodEnd ? (
                    <ResearchHubStatChip
                      label="Periode"
                      value={`${r.periodStart.slice(0, 10)} – ${r.periodEnd.slice(0, 10)}`}
                    />
                  ) : null}
                  <ResearchHubStatChip
                    label="Dibuat"
                    value={formatRelativeTime(new Date(r.createdAt))}
                  />
                </div>

                <div className="mt-3 flex gap-1 border-t border-border/40 pt-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending || isInProgress(r.status)}
                    onClick={() => handleRefresh(r.id)}
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={pending}
                    onClick={() => handleDelete(r.id)}
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
