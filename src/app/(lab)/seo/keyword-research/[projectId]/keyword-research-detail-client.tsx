"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus, SeoKeywordIntent } from "@prisma/client";
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SeoDetailPage } from "@/components/seo/seo-module-page";
import {
  LabEmptyState,
  lab,
} from "@/components/lab/lab-primitives";
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import { SEO_INTENT_LABELS, isSeoStatusBusy } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import { refreshSeoKeywordProject } from "@/actions/seo-keyword-research";
import { cn } from "@/lib/utils";

export type KeywordRow = {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  difficulty: number | null;
  intent: SeoKeywordIntent;
  clusterLabel: string | null;
  trend: "up" | "down" | "flat" | null;
  source: string | null;
};

type ProjectInfo = {
  id: string;
  name: string;
  seedKeyword: string;
  status: SeoAnalysisStatus;
  aiSummary: string | null;
  dataNotice: string | null;
  errorMessage: string | null;
};

const INTENT_BADGE: Record<SeoKeywordIntent, "default" | "secondary" | "outline"> = {
  TRANSACTIONAL: "default",
  COMMERCIAL: "secondary",
  INFORMATIONAL: "outline",
  NAVIGATIONAL: "outline",
  UNKNOWN: "outline",
};

function difficultyClass(difficulty: number | null): string {
  if (difficulty == null) return "text-muted-foreground";
  if (difficulty < 30) return "text-emerald-600 dark:text-emerald-400";
  if (difficulty <= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function TrendIcon({ trend }: { trend: KeywordRow["trend"] }) {
  if (trend === "up")
    return <ArrowUpRight className="size-3.5 text-emerald-500" aria-label="naik" />;
  if (trend === "down")
    return <ArrowDownRight className="size-3.5 text-red-500" aria-label="turun" />;
  return <Minus className="size-3.5 text-muted-foreground" aria-label="stabil" />;
}

function formatNumber(value: number | null): string {
  return value == null ? "—" : value.toLocaleString("id-ID");
}

export function KeywordResearchDetailClient({
  project,
  keywords,
}: {
  project: ProjectInfo;
  keywords: KeywordRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyRefresh, setBusyRefresh] = useState(false);

  const busy = isSeoStatusBusy(project.status);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [busy, router]);

  // Kelompokkan keyword per cluster.
  const clusters = useMemo(() => {
    const map = new Map<string, KeywordRow[]>();
    for (const k of keywords) {
      const label = k.clusterLabel || "Lainnya";
      const list = map.get(label) ?? [];
      list.push(k);
      map.set(label, list);
    }
    return [...map.entries()]
      .map(([label, rows]) => ({
        label,
        rows,
        totalVolume: rows.reduce((s, r) => s + (r.searchVolume ?? 0), 0),
      }))
      .sort((a, b) => b.totalVolume - a.totalVolume);
  }, [keywords]);

  function handleRefresh() {
    setBusyRefresh(true);
    startTransition(async () => {
      try {
        await refreshSeoKeywordProject(project.id);
        toast.success("Riset ulang dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh."));
      } finally {
        setBusyRefresh(false);
      }
    });
  }

  return (
    <SeoDetailPage
      icon={Search}
      title={project.name}
      description={`Seed: "${project.seedKeyword}" · ${keywords.length} keyword`}
      right={
        <div className="flex items-center gap-2">
          <SeoStatusBadge status={project.status} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={pending || busyRefresh || busy}
          >
            <RefreshCw className={cn(busyRefresh && "animate-spin")} />
            Riset ulang
          </Button>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/seo/keyword-research" />}
          >
            <ArrowLeft />
            Kembali
          </Button>
        </div>
      }
    >
      {project.status === SeoAnalysisStatus.FAILED && project.errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {project.errorMessage}
        </div>
      ) : null}

      {project.dataNotice ? (
        <div className={cn(lab.nestedPanel, "text-muted-foreground text-sm")}>
          {project.dataNotice}
        </div>
      ) : null}

      {project.aiSummary ? (
        <div className={lab.panel}>
          <p className={cn(lab.label, "mb-2")}>Ringkasan strategi</p>
          <p className="text-sm leading-relaxed">{project.aiSummary}</p>
        </div>
      ) : null}

      {keywords.length === 0 ? (
        <LabEmptyState
          icon={Search}
          title={busy ? "Sedang meriset…" : "Belum ada keyword"}
          description={
            busy
              ? "Mengumpulkan keyword dari DataForSEO. Halaman akan ter-update otomatis."
              : "Belum ada keyword untuk proyek ini."
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {clusters.map((cluster) => (
            <div key={cluster.label} className={cn(lab.card, "p-4")}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-foreground font-semibold">{cluster.label}</h3>
                <span className="text-muted-foreground text-xs">
                  {cluster.rows.length} keyword · vol{" "}
                  {formatNumber(cluster.totalVolume)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Keyword</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">Difficulty</TableHead>
                      <TableHead className="text-right">Komp.</TableHead>
                      <TableHead className="text-right">CPC</TableHead>
                      <TableHead>Intent</TableHead>
                      <TableHead className="text-center">Tren</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cluster.rows.map((k) => (
                      <TableRow key={k.keyword}>
                        <TableCell className="font-medium">{k.keyword}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(k.searchVolume)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums font-medium",
                            difficultyClass(k.difficulty),
                          )}
                        >
                          {k.difficulty ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {k.competition != null
                            ? `${Math.round(k.competition * 100)}%`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {k.cpc != null ? `$${k.cpc.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={INTENT_BADGE[k.intent]}>
                            {SEO_INTENT_LABELS[k.intent]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex justify-center">
                            <TrendIcon trend={k.trend} />
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      )}
    </SeoDetailPage>
  );
}
