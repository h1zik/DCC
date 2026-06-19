"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, FileText, RefreshCw } from "lucide-react";
import { KeywordIntelStatus, ResearchMarketplace } from "@prisma/client";
import { toast } from "sonner";
import { createProductBriefFromKeyword } from "@/actions/research-brief";
import { refreshBrandKeywordIntelQuery } from "@/actions/brand-keyword-intel";
import { actionErrorMessage } from "@/lib/action-error-message";
import { ActionPlanPanel } from "@/components/research-hub/action-plan-panel";
import { CopyKeywordsPanel } from "@/components/research-hub/copy-keywords-panel";
import { KeywordEvidenceTable } from "@/components/research-hub/keyword-evidence-table";
import { KeywordGapList } from "@/components/research-hub/keyword-gap-list";
import { KeywordMatrixTable } from "@/components/research-hub/keyword-matrix-table";
import { KeywordOpportunityChart } from "@/components/research-hub/keyword-opportunity-chart";
import { KeywordQualityBanner } from "@/components/research-hub/keyword-quality-banner";
import { KeywordSignalStatsLine } from "@/components/research-hub/keyword-signal-stats-line";
import { NamingSuggestionsCard } from "@/components/research-hub/naming-suggestions-card";
import {
  SeasonalKeywordChart,
  type SeasonalMonth,
} from "@/components/research-hub/seasonal-keyword-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  KEYWORD_INTEL_STATUS_LABELS,
  MARKETPLACE_LABELS,
} from "@/lib/research/labels";
import type {
  GapKeywordRow,
  KeywordMatrixRow,
  KeywordSignalStats,
  SeasonalCurve,
} from "@/lib/research/keyword-intel/keyword-signal-types";
import { cn } from "@/lib/utils";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";

export type KeywordDetailData = {
  id: string;
  category: string;
  seedKeyword: string | null;
  marketplace: ResearchMarketplace | null;
  status: KeywordIntelStatus;
  dataNotice: string | null;
  signalStats: KeywordSignalStats | null;
  volumeSource: string | null;
  errorMessage: string | null;
  aiSummary: string | null;
  hasGoogleVolume: boolean;
  matrix: KeywordMatrixRow[];
  gaps: GapKeywordRow[];
  namingSuggestions: string[];
  copyKeywords: {
    listingTitle?: string[];
    listingDescription?: string[];
    socialMedia?: string[];
  };
  seasonalCalendar: SeasonalMonth[];
  seasonalCurves: SeasonalCurve[];
  clusters: { name: string; keywords: string[] }[];
  actionPlan: unknown;
  aiMeta: ResearchAiMetaView | null;
  rooms: {
    id: string;
    name: string;
    brandId: string | null;
    brandName: string | null;
  }[];
};

export function BrandKeywordDetailClient({ data }: { data: KeywordDetailData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [briefOpen, setBriefOpen] = useState(false);
  const [roomId, setRoomId] = useState(data.rooms[0]?.id ?? "");
  const [projectName, setProjectName] = useState(`Keyword: ${data.category}`);

  const selectedRoom = data.rooms.find((r) => r.id === roomId);
  const canBrief = data.status === "READY";

  const volumeByKeyword = data.matrix.reduce<Record<string, number>>(
    (acc, row) => {
      if (typeof row.volume === "number" && row.volume > 0) {
        acc[row.keyword.trim().toLowerCase()] = row.volume;
      }
      return acc;
    },
    {},
  );

  const opportunityPoints = data.matrix
    .filter((m) => (m.koiScore ?? 0) > 0)
    .slice(0, 40)
    .map((m) => ({
      keyword: m.keyword,
      volume: m.volume,
      listingSampleCount: m.listingSampleCount ?? 0,
      koiScore: m.koiScore ?? 0,
    }));

  function handleRefresh() {
    startTransition(async () => {
      try {
        await refreshBrandKeywordIntelQuery(data.id);
        toast.success("Refresh dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
      }
    });
  }

  function handleBrief() {
    if (!selectedRoom?.brandId) {
      toast.error("Pilih room dengan brand.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createProductBriefFromKeyword({
          queryId: data.id,
          roomId,
          brandId: selectedRoom.brandId!,
          projectName,
        });
        toast.success("Brief dibuat.");
        setBriefOpen(false);
        router.push(`/projects/${result.projectId}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
      }
    });
  }

  const isProcessing =
    data.status === "COLLECTING" ||
    data.status === "ANALYZING" ||
    data.status === "PENDING";

  return (
    <div className="flex flex-col gap-6 pb-6">
      <ResearchModelBadgeGroup meta={data.aiMeta} />
      <KeywordQualityBanner dataNotice={data.dataNotice} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/brand-hub/keyword-intel"
            className="text-muted-foreground mb-2 inline-flex items-center gap-1 text-xs hover:underline"
          >
            <ArrowLeft className="size-3" aria-hidden />
            Keyword Intel
          </Link>
          <h1 className="text-xl font-semibold">{data.category}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {data.seedKeyword ? `Seed: ${data.seedKeyword} · ` : ""}
            {data.marketplace
              ? MARKETPLACE_LABELS[data.marketplace]
              : "Semua marketplace"}{" "}
            ·{" "}
            <span
              className={cn(
                data.status === "READY"
                  ? "text-emerald-600"
                  : data.status === "FAILED"
                    ? "text-rose-600"
                    : "text-amber-600",
              )}
            >
              {KEYWORD_INTEL_STATUS_LABELS[data.status]}
            </span>
            {data.volumeSource ? ` · ${data.volumeSource}` : ""}
          </p>
          <KeywordSignalStatsLine stats={data.signalStats} />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={pending || isProcessing}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Refresh
          </Button>
          {data.status === "READY" ? (
            <Dialog open={briefOpen} onOpenChange={setBriefOpen}>
              <DialogTrigger
                render={
                  <Button size="sm" disabled={!canBrief}>
                    <FileText className="size-3.5" aria-hidden />
                    Buat Brief
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Buat Product Brief dari Keyword Intel</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="grid gap-1.5">
                    <Label>Room / Brand</Label>
                    <Select value={roomId} onValueChange={(v) => setRoomId(v ?? "")}>
                      <SelectTrigger>
                        {selectedRoom
                          ? `${selectedRoom.name}${selectedRoom.brandName ? ` (${selectedRoom.brandName})` : ""}`
                          : "Pilih room"}
                      </SelectTrigger>
                      <SelectContent>
                        {data.rooms.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                            {r.brandName ? ` — ${r.brandName}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Nama proyek</Label>
                    <Input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleBrief} disabled={pending || !canBrief}>
                    Buat Brief
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>

      {data.errorMessage ? (
        <p className="text-rose-600 text-sm">{data.errorMessage}</p>
      ) : null}

      {data.aiSummary ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">AI Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{data.aiSummary}</p>
          </CardContent>
        </Card>
      ) : null}

      {data.actionPlan ? (
        <ActionPlanPanel plan={data.actionPlan} title="Rencana Aksi Keyword (AI)" />
      ) : null}

      {isProcessing ? (
        <p className="text-muted-foreground text-sm">
          Mengumpulkan dan menganalisis keyword…
        </p>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Peta Peluang (Volume vs Saturasi)</CardTitle>
            </CardHeader>
            <CardContent>
              <KeywordOpportunityChart points={opportunityPoints} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Keyword Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <KeywordMatrixTable
                rows={data.matrix}
                hasGoogleVolume={data.hasGoogleVolume}
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Keyword Gap</CardTitle>
              </CardHeader>
              <CardContent>
                <KeywordGapList gaps={data.gaps} />
              </CardContent>
            </Card>
            <NamingSuggestionsCard suggestions={data.namingSuggestions} />
          </div>

          {data.matrix.some((m) => (m.evidence?.length ?? 0) > 0) ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Bukti Sinyal (top keyword)</CardTitle>
              </CardHeader>
              <CardContent>
                <KeywordEvidenceTable
                  evidence={data.matrix[0]?.evidence ?? []}
                />
              </CardContent>
            </Card>
          ) : null}

          <CopyKeywordsPanel data={data.copyKeywords} />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Seasonal Keyword Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              <SeasonalKeywordChart
                data={data.seasonalCalendar}
                volumeByKeyword={volumeByKeyword}
                seasonalCurves={data.seasonalCurves}
              />
            </CardContent>
          </Card>

          {data.clusters.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Keyword Clusters</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {data.clusters.map((c) => (
                  <div key={c.name} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {c.keywords.join(", ")}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <div className="flex flex-wrap gap-2 text-xs">
            <Link
              href="/brand-hub/competitor-tracker"
              className="text-primary hover:underline"
            >
              Competitor Tracker
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link
              href="/brand-hub/trend-radar"
              className="text-primary hover:underline"
            >
              Trend Radar
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link
              href="/brand-hub/review-intelligence"
              className="text-primary hover:underline"
            >
              Review Intel
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
