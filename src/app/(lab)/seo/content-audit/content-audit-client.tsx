"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  Lightbulb,
  Loader2,
  Minus,
  Play,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import {
  LabEmptyState,
  LabStatChip,
  lab,
} from "@/components/lab/lab-primitives";
import { isSeoStatusBusy } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createContentAudit,
  createOpportunityFromDecay,
  deleteContentAudit,
} from "@/actions/seo-content-audit";
import type {
  AuditPageRow,
  AuditSummary,
} from "@/lib/seo/gsc/content-audit-rules";
import { cn } from "@/lib/utils";

export type ContentAuditListRow = {
  id: string;
  siteUrl: string;
  status: SeoAnalysisStatus;
  windowDays: number;
  rows: AuditPageRow[];
  summary: AuditSummary | null;
  dataNotice: string | null;
  errorMessage: string | null;
  createdAt: string;
};

const STATUS_META: Record<
  AuditPageRow["status"],
  { label: string; className: string }
> = {
  decay: { label: "Menurun", className: "text-red-600 dark:text-red-400" },
  rising: { label: "Naik", className: "text-emerald-600 dark:text-emerald-400" },
  fresh: { label: "Baru", className: "text-sky-600 dark:text-sky-400" },
  stable: { label: "Stabil", className: "text-muted-foreground" },
};

export function ContentAuditClient({
  items,
  gscConfigured,
}: {
  items: ContentAuditListRow[];
  gscConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [actingPage, setActingPage] = useState<string | null>(null);
  const [filter, setFilter] = useState<AuditPageRow["status"] | "all">("decay");

  const latest = items[0] ?? null;
  const busy = latest ? isSeoStatusBusy(latest.status) : false;

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [busy, router]);

  function handleRun() {
    startTransition(async () => {
      try {
        await createContentAudit();
        toast.success("Audit konten dimulai — menarik data Search Console.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memulai audit."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteContentAudit(id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  function handleCreateOpportunity(row: AuditPageRow) {
    const keyword = row.topQueries[0]?.query;
    if (!keyword) {
      toast.error("Halaman ini tidak punya data query — tidak bisa dibuat opportunity.");
      return;
    }
    setActingPage(row.page);
    startTransition(async () => {
      try {
        await createOpportunityFromDecay({ page: row.page, keyword });
        toast.success(`Masuk ke feed Opportunities (keyword: "${keyword}").`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat opportunity."));
      } finally {
        setActingPage(null);
      }
    });
  }

  if (!gscConfigured) {
    return (
      <LabEmptyState
        icon={Activity}
        title="Google Search Console belum terhubung"
        description="Set GSC_SERVICE_ACCOUNT_EMAIL, GSC_PRIVATE_KEY, dan GSC_SITE_URL di environment, lalu tambahkan email service account sebagai user di properti Search Console. Setelah itu jalankan audit dari sini."
      />
    );
  }

  const rows = latest?.rows ?? [];
  const visible =
    filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const summary = latest?.summary ?? null;

  const filters: { key: AuditPageRow["status"] | "all"; label: string }[] = [
    { key: "decay", label: `Menurun (${summary?.decayed ?? 0})` },
    { key: "rising", label: `Naik (${summary?.rising ?? 0})` },
    { key: "fresh", label: `Baru (${summary?.fresh ?? 0})` },
    { key: "stable", label: `Stabil (${summary?.stable ?? 0})` },
    { key: "all", label: "Semua" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          {summary ? (
            <>
              <LabStatChip
                label={`Klik ${latest!.windowDays} hari`}
                value={summary.totalClicks.toLocaleString("id-ID")}
                tone="accent"
              />
              <LabStatChip
                label="Periode sebelumnya"
                value={summary.prevTotalClicks.toLocaleString("id-ID")}
              />
              <LabStatChip
                label="Halaman menurun"
                value={summary.decayed}
                tone={summary.decayed > 0 ? "warning" : undefined}
              />
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {latest ? <SeoStatusBadge status={latest.status} /> : null}
          <Button onClick={handleRun} disabled={pending || busy} size="sm">
            {busy ? <Loader2 className="animate-spin" /> : <Play />}
            Jalankan audit
          </Button>
          {latest ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleDelete(latest.id)}
              disabled={pending || busy}
              aria-label="Hapus audit"
            >
              <Trash2 className="text-destructive" />
            </Button>
          ) : null}
        </div>
      </div>

      {latest?.errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {latest.errorMessage}
        </div>
      ) : null}
      {latest?.dataNotice ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400">
          {latest.dataNotice}
        </div>
      ) : null}

      {!latest ? (
        <LabEmptyState
          icon={Activity}
          title="Belum ada audit"
          description="Klik “Jalankan audit” untuk melihat halaman mana yang trafik organiknya menurun berdasarkan data Search Console."
        />
      ) : busy ? (
        <div className={cn(lab.card, "flex items-center justify-center gap-3 p-10")}>
          <Loader2 className="text-primary size-6 animate-spin" />
          <p className="text-muted-foreground text-sm">
            Menarik data Search Console ({latest.siteUrl})…
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            {filters.map((f) => (
              <Button
                key={f.key}
                variant={filter === f.key ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          <div className={cn(lab.card, "overflow-x-auto p-4")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Halaman</TableHead>
                  <TableHead className="text-right">Klik</TableHead>
                  <TableHead className="text-right">Sebelumnya</TableHead>
                  <TableHead className="text-right">Δ</TableHead>
                  <TableHead>Query teratas</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.slice(0, 100).map((row) => {
                  const meta = STATUS_META[row.status];
                  return (
                    <TableRow key={row.page}>
                      <TableCell className="max-w-96">
                        <a
                          href={row.page}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-full items-center gap-1 truncate text-sm font-medium hover:underline"
                        >
                          <span className="truncate">
                            {row.page.replace(/^https?:\/\/[^/]+/, "") || row.page}
                          </span>
                          <ExternalLink className="size-3 shrink-0" />
                        </a>
                        <span className={cn("block text-xs", meta.className)}>
                          {meta.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {row.clicks.toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right tabular-nums">
                        {row.prevClicks.toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.deltaPct == null ? (
                          <Minus className="text-muted-foreground ml-auto size-3.5" />
                        ) : row.deltaPct >= 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                            <ArrowUpRight className="size-3.5" />
                            {row.deltaPct}%
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-red-600 dark:text-red-400">
                            <ArrowDownRight className="size-3.5" />
                            {row.deltaPct}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-56 flex-wrap gap-1">
                          {row.topQueries.length === 0 ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : (
                            row.topQueries.map((q) => (
                              <Badge
                                key={q.query}
                                variant="outline"
                                className="max-w-full truncate text-[10px]"
                              >
                                {q.query}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {row.status === "decay" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCreateOpportunity(row)}
                            disabled={pending && actingPage === row.page}
                          >
                            {pending && actingPage === row.page ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <Lightbulb />
                            )}
                            Ke feed
                          </Button>
                        ) : row.status === "rising" ? (
                          <Sparkles className="text-muted-foreground ml-auto size-4" />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {visible.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Tidak ada halaman di kategori ini.
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
