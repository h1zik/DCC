"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { FileText, RefreshCw, Sparkles } from "lucide-react";
import { ResearchReportType } from "@prisma/client";
import { toast } from "sonner";
import { createResearchReport } from "@/actions/research-reports";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { RESEARCH_REPORT_TYPE_LABELS } from "@/lib/research/labels";
import type { SelectItemDef } from "@/lib/select-option-items";
import { lab } from "@/components/lab/lab-primitives";
import { cn } from "@/lib/utils";

const REPORT_TYPE_ITEMS: SelectItemDef[] = (
  Object.keys(RESEARCH_REPORT_TYPE_LABELS) as ResearchReportType[]
)
  .filter((t) => t !== "WEEKLY")
  .map((t) => ({ value: t, label: RESEARCH_REPORT_TYPE_LABELS[t] }));

const TYPE_HINT: Partial<Record<ResearchReportType, string>> = {
  CUSTOM: "Laporan bebas dari modul dan sumber yang kamu pilih.",
  CATEGORY_DEEP_DIVE: "Bedah satu kategori secara menyeluruh. Wajib isi kategori.",
  COMPETITOR_BATTLE: "Battle card satu kompetitor: kekuatan, kelemahan, dan cara menang.",
  TREND_BRIEF: "Ringkasan tren dari digest Trend Radar.",
};

/** Form laporan baru (inline panel). State form dimiliki komponen ini. */
export function NewReportForm({
  id,
  options,
  availableModules,
  onCancel,
  onCreated,
}: {
  id: string;
  options: ReportSourceOptions;
  availableModules: ReportAvailableModules;
  onCancel?: () => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [suggestPending, setSuggestPending] = useState(false);
  const [reportType, setReportType] = useState<ResearchReportType>(ResearchReportType.CUSTOM);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [competitorId, setCompetitorId] = useState("");
  const [digestId, setDigestId] = useState("");
  const [modules, setModules] = useState<ReportModuleToggles>(() =>
    defaultReportModules(availableModules),
  );
  const [selections, setSelections] = useState<ReportSourceSelections>({});

  const competitorItems = useMemo(
    (): SelectItemDef[] =>
      options.competitors.map((c) => ({ value: c.id, label: `${c.label} (${c.meta})` })),
    [options.competitors],
  );

  const digestItems = useMemo(
    (): SelectItemDef[] =>
      options.digests.map((d) => ({ value: d.id, label: `${d.label} (${d.meta})` })),
    [options.digests],
  );

  const showModulePickers =
    reportType === ResearchReportType.CUSTOM ||
    reportType === ResearchReportType.CATEGORY_DEEP_DIVE;

  function handleSuggest() {
    if (!category.trim()) {
      toast.error("Isi kategori dulu agar sumber bisa disarankan.");
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
        toast.success("Sumber yang disarankan sudah dipilih.");
      } catch (err) {
        toast.error(actionErrorMessage(err, "Saran sumber gagal diambil. Pilih sumber secara manual."));
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
            toast.error("Deep dive butuh kategori. Isi kategori dulu.");
            return;
          }
          config.category = category;
          config.modules = modules;
        }
        if (reportType === ResearchReportType.COMPETITOR_BATTLE) {
          if (!competitorId) {
            toast.error("Pilih kompetitor untuk battle card.");
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
        toast.success("Laporan sedang ditulis.");
        onCreated();
        router.push(`/research-hub/research-reports/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Laporan gagal dibuat."));
      }
    });
  }

  const creating = pending && !suggestPending;

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        lab.panel,
        "grid gap-5",
        "animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none",
      )}
    >
      <div className="space-y-1">
        <h2 id={`${id}-title`} className="rh-section-title">
          Tulis laporan riset
        </h2>
        <p className="rh-lede">
          Pilih jenis laporan dan sumbernya. Kosongkan sumber agar sistem
          memilih otomatis berdasarkan kategori.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-type`}>Jenis laporan</Label>
          <Select
            value={reportType}
            items={REPORT_TYPE_ITEMS}
            onValueChange={(v) => v && setReportType(v as ResearchReportType)}
          >
            <SelectTrigger id={`${id}-type`} aria-describedby={`${id}-type-hint`} />
            <SelectContent>
              {REPORT_TYPE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p id={`${id}-type-hint`} className="rh-meta">
            {TYPE_HINT[reportType]}
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-name`}>
            Judul <span className="text-muted-foreground font-normal">(opsional)</span>
          </Label>
          <Input
            id={`${id}-name`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Dibuat otomatis bila kosong"
            disabled={pending}
          />
        </div>
      </div>

      {reportType === "COMPETITOR_BATTLE" && (
        <div className="grid gap-1.5 sm:max-w-md">
          <Label htmlFor={`${id}-competitor`}>Kompetitor</Label>
          <Select
            value={competitorId}
            items={competitorItems}
            onValueChange={(v) => v && setCompetitorId(v)}
          >
            <SelectTrigger id={`${id}-competitor`} />
            <SelectContent>
              {options.competitors.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                  <span className="text-muted-foreground ms-1.5">{c.meta}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {reportType === "TREND_BRIEF" && (
        <div className="grid gap-1.5 sm:max-w-md">
          <Label htmlFor={`${id}-digest`}>
            Digest tren <span className="text-muted-foreground font-normal">(opsional)</span>
          </Label>
          <Select value={digestId} items={digestItems} onValueChange={(v) => v && setDigestId(v)}>
            <SelectTrigger id={`${id}-digest`} />
            <SelectContent>
              {options.digests.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                  <span className="text-muted-foreground ms-1.5">{d.meta}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showModulePickers && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-category`}>
              Kategori
              {reportType === "CUSTOM" ? (
                <span className="text-muted-foreground font-normal"> (opsional)</span>
              ) : null}
            </Label>
            <div className="flex gap-2">
              <Input
                id={`${id}-category`}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder='Mis. "lip cream"'
                aria-describedby={`${id}-category-hint`}
                disabled={pending}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={suggestPending || pending || !category.trim()}
                onClick={handleSuggest}
              >
                {suggestPending ? (
                  <RefreshCw className="animate-spin" aria-hidden />
                ) : (
                  <Sparkles aria-hidden />
                )}
                Sarankan sumber
              </Button>
            </div>
            <p id={`${id}-category-hint`} className="rh-meta">
              Dipakai untuk memilih sumber data yang paling relevan.
            </p>
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Sumber modul</legend>
            <ResearchReportSourcePicker
              options={options}
              available={availableModules}
              modules={modules}
              selections={selections}
              onToggleModule={toggleModule}
              onSelectionsChange={setSelections}
            />
          </fieldset>
        </>
      )}

      <div className="border-border/60 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        {showModulePickers ? (
          <div className="min-w-0">
            <p className="rh-meta mb-1.5">Modul aktif</p>
            <ReportModuleSummaryChips modules={modules} available={availableModules} />
          </div>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {onCancel ? (
            <Button variant="ghost" onClick={onCancel} disabled={pending}>
              Batal
            </Button>
          ) : null}
          <Button onClick={handleCreate} disabled={pending}>
            {creating ? <RefreshCw className="animate-spin" aria-hidden /> : <FileText aria-hidden />}
            {creating ? "Memulai…" : "Tulis laporan"}
          </Button>
        </div>
      </div>
    </section>
  );
}
