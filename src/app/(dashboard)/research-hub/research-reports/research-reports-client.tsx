"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FileText, Plus, RefreshCw, Trash2 } from "lucide-react";
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

export type ReportPickerOptions = {
  competitors: { id: string; name: string }[];
  digests: { id: string; label: string }[];
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
}: {
  reports: ReportRow[];
  latestWeeklyId: string | null;
  options: ReportPickerOptions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reportType, setReportType] = useState<ResearchReportType>(
    ResearchReportType.CUSTOM,
  );
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [competitorId, setCompetitorId] = useState("");
  const [digestId, setDigestId] = useState("");
  const [modules, setModules] = useState({
    reviewIntel: true,
    competitor: true,
    trendRadar: true,
    keywordIntel: true,
    socialListening: true,
    uspAnalyzer: true,
    conceptLab: true,
  });

  const hasInProgress = reports.some(
    (r) => r.status === "GENERATING" || r.status === "PENDING",
  );

  useEffect(() => {
    if (!hasInProgress) return;
    const id = window.setInterval(() => router.refresh(), 12_000);
    return () => window.clearInterval(id);
  }, [hasInProgress, router]);

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

        const result = await createResearchReport({
          type: reportType,
          title: title || undefined,
          config,
        });
        toast.success("Laporan sedang dibuat.");
        setDialogOpen(false);
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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="mr-1.5 size-4" />
                Buat Laporan
              </Button>
            }
          />
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Buat Laporan Riset</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
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
              {(reportType === "CUSTOM" ||
                reportType === "CATEGORY_DEEP_DIVE") && (
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </div>
              )}
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
                          {c.name}
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
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {reportType === "CUSTOM" && (
                <div className="space-y-2">
                  <Label>Modul sumber</Label>
                  <div className="space-y-1.5">
                    {(Object.keys(modules) as (keyof typeof modules)[]).map(
                      (key) => (
                        <label key={key} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={modules[key]}
                            onCheckedChange={() =>
                              setModules((prev) => ({
                                ...prev,
                                [key]: !prev[key],
                              }))
                            }
                          />
                          {key}
                        </label>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
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
