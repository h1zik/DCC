"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowUpRight,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
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
import { lab, LabEmptyState } from "@/components/lab/lab-primitives";
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

function isInProgress(status: ResearchReportStatus) {
  return status === "GENERATING" || status === "PENDING";
}

/** Pill status tinted ala bento. */
function StatusPill({ status }: { status: ResearchReportStatus }) {
  const tone =
    status === "READY"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : status === "FAILED"
        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
        : isInProgress(status)
          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
          : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone,
      )}
    >
      {isInProgress(status) ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : null}
      {RESEARCH_REPORT_STATUS_LABELS[status]}
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
  const [formOpen, setFormOpen] = useState(reports.length === 0);
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
  const inProgressCount = reports.filter((r) => isInProgress(r.status)).length;
  const failedCount = reports.filter((r) => r.status === "FAILED").length;

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
    const id = window.setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 12_000);
    return () => window.clearInterval(id);
  }, [hasInProgress, router]);

  function resetForm() {
    setTitle("");
    setCategory("");
    setCompetitorId("");
    setDigestId("");
    setModules(defaultReportModules(availableModules));
    setSelections({});
  }

  function toggleForm() {
    setFormOpen((open) => {
      if (open) resetForm();
      return !open;
    });
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
        setFormOpen(false);
        resetForm();
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
      {/* Strip ringkasan bento */}
      {reports.length > 0 ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          <div className="bento-tile border-transparent bg-violet-600 shadow-md shadow-violet-600/20 dark:bg-violet-500">
            <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
              Total laporan
            </span>
            <span className="bento-value text-white dark:text-violet-950">
              {reports.length}
            </span>
            <span className="text-[11px] font-medium text-violet-100/90 dark:text-violet-900/80">
              weekly digest, deep dive & battle card
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Siap dibaca</span>
            <span className="bento-value">{readyCount}</span>
            <span className="text-muted-foreground text-[11px] font-medium">
              export PDF & share link
            </span>
          </div>

          <div
            className={cn(
              "bento-tile",
              inProgressCount > 0
                ? "border-transparent bg-[#ffedcd] dark:bg-amber-400/10"
                : undefined,
            )}
          >
            <span
              className={cn(
                inProgressCount > 0
                  ? "text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60"
                  : "bento-label",
              )}
            >
              Berjalan
            </span>
            <span
              className={cn(
                "bento-value",
                inProgressCount > 0 && "text-amber-900 dark:text-amber-300",
              )}
            >
              {inProgressCount}
            </span>
            <span
              className={cn(
                "text-[11px] font-medium",
                inProgressCount > 0
                  ? "text-amber-800/70 dark:text-amber-200/60"
                  : "text-muted-foreground",
              )}
            >
              {inProgressCount > 0
                ? "halaman refresh otomatis"
                : "tidak ada job berjalan"}
            </span>
          </div>

          <div
            className={cn(
              "bento-tile",
              failedCount > 0
                ? "border-transparent bg-[#fbdcd7] dark:bg-rose-400/10"
                : undefined,
            )}
          >
            <span
              className={cn(
                failedCount > 0
                  ? "text-[11.5px] font-semibold text-rose-800/70 dark:text-rose-200/60"
                  : "bento-label",
              )}
            >
              Gagal
            </span>
            <span
              className={cn(
                "bento-value",
                failedCount > 0 && "text-rose-900 dark:text-rose-300",
              )}
            >
              {failedCount}
            </span>
            <span
              className={cn(
                "text-[11px] font-medium",
                failedCount > 0
                  ? "text-rose-800/70 dark:text-rose-200/60"
                  : "text-muted-foreground",
              )}
            >
              {failedCount > 0 ? "coba refresh ulang" : "semua generasi lancar"}
            </span>
          </div>
        </div>
      ) : null}

      {latestWeeklyId ? (
        <div
          className={cn(
            lab.entrance,
            "bento-tile flex-row items-center justify-between border-transparent bg-[#e9e3f9] dark:bg-violet-400/10",
          )}
        >
          <span className="text-sm font-medium text-violet-950 dark:text-violet-200">
            <Sparkles
              className="mr-1.5 inline size-4 text-violet-600 dark:text-violet-300"
              aria-hidden
            />
            Laporan mingguan terbaru sudah tersedia.
          </span>
          <Link
            href={`/research-hub/research-reports/${latestWeeklyId}`}
            className="shrink-0 text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300"
          >
            Buka laporan →
          </Link>
        </div>
      ) : null}

      {hasInProgress ? (
        <div className={lab.entrance}>
          <JobProgressBar
            title="Generate laporan berjalan"
            percent={50}
            stepLabel="Mengagregasi data modul riset lalu menulis section laporan dengan AI."
          />
        </div>
      ) : null}

      {/* Daftar laporan + form collapsible */}
      <section className={cn(lab.section, lab.entrance)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={lab.sectionTitle}>Laporan Riset</h2>
            <p className={lab.sectionDesc}>
              {reports.length === 0
                ? "Buat laporan pertama Anda di bawah."
                : `${reports.length} laporan · ${readyCount} siap dibaca.`}
            </p>
          </div>
          <Button
            size="sm"
            variant={formOpen ? "outline" : "default"}
            onClick={toggleForm}
          >
            {formOpen ? (
              <X className="mr-1.5 size-3.5" aria-hidden />
            ) : (
              <Plus className="mr-1.5 size-3.5" aria-hidden />
            )}
            {formOpen ? "Tutup" : "Buat Laporan"}
          </Button>
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
                Buat laporan riset
              </p>
              <p className="text-muted-foreground text-sm">
                Pilih modul sumber dan record spesifik — kosongkan untuk
                auto-suggest berdasarkan kategori.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Tipe laporan</Label>
                <Select
                  value={reportType}
                  items={REPORT_TYPE_ITEMS}
                  onValueChange={(v) =>
                    v && setReportType(v as ResearchReportType)
                  }
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
              <div className="grid gap-1.5">
                <Label>Judul (opsional)</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={pending}
                />
              </div>
            </div>

            {reportType === "COMPETITOR_BATTLE" && (
              <div className="grid gap-1.5">
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
              <div className="grid gap-1.5">
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
                <section className={cn(lab.nestedPanel, "space-y-3")}>
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

            <div className="border-border/60 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <ReportModuleSummaryChips
                modules={modules}
                available={availableModules}
              />
              <Button onClick={handleCreate} disabled={pending}>
                {pending ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 size-3.5" aria-hidden />
                )}
                Generate
              </Button>
            </div>
          </div>
        ) : null}

        {reports.length === 0 ? (
          formOpen ? null : (
            <LabEmptyState
              icon={FileText}
              title="Belum ada laporan riset"
              description="Buat laporan custom atau deep dive — pilih sumber modul spesifik agar isi laporan lebih terbukti."
              action={
                <Button size="sm" onClick={() => setFormOpen(true)}>
                  <Plus className="size-3.5" aria-hidden />
                  Buat Laporan
                </Button>
              }
            />
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {reports.map((r) => (
              <div
                key={r.id}
                className={cn(lab.card, "group flex flex-col p-0")}
              >
                <Link
                  href={`/research-hub/research-reports/${r.id}`}
                  className="flex flex-1 flex-col gap-4 p-5 pb-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl"
                        aria-hidden
                      >
                        <FileText className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                          <span className="truncate">{r.title}</span>
                          <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {RESEARCH_REPORT_TYPE_LABELS[r.type]}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={r.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <CardStat
                      label="Periode"
                      value={
                        r.periodStart && r.periodEnd
                          ? `${r.periodStart.slice(0, 10)} – ${r.periodEnd.slice(0, 10)}`
                          : "—"
                      }
                    />
                    <CardStat
                      label="Dibuat"
                      value={formatRelativeTime(new Date(r.createdAt))}
                    />
                  </div>

                  {r.status === "FAILED" && r.errorMessage ? (
                    <p className="truncate text-xs text-rose-700 dark:text-rose-300">
                      {r.errorMessage}
                    </p>
                  ) : null}
                </Link>

                <div className="border-border/60 flex items-center justify-between gap-2 border-t px-3 py-2">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                    <FileText className="size-3.5" aria-hidden />
                    {RESEARCH_REPORT_TYPE_LABELS[r.type]}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending || isInProgress(r.status)}
                      onClick={() => handleRefresh(r.id)}
                    >
                      <RefreshCw className="size-3.5" aria-hidden />
                      Refresh
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={pending}
                      onClick={() => handleDelete(r.id)}
                      aria-label="Hapus laporan"
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
