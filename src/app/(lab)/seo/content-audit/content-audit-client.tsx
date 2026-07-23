"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import { LabEmptyState, lab } from "@/components/lab/lab-primitives";
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

/** Pill tinted per tren halaman: menurun → rose, naik → emerald, baru → sky. */
const STATUS_META: Record<
  AuditPageRow["status"],
  { label: string; className: string }
> = {
  decay: {
    label: "Menurun",
    className: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
  rising: {
    label: "Naik",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  fresh: {
    label: "Baru",
    className: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  stable: {
    label: "Stabil",
    className: "bg-muted text-muted-foreground",
  },
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
  const [query, setQuery] = useState("");

  const latest = items[0] ?? null;
  const busy = latest ? isSeoStatusBusy(latest.status) : false;

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 4000);
    return () => clearInterval(timer);
  }, [busy, router]);

  const rows = useMemo(() => latest?.rows ?? [], [latest]);
  const summary = latest?.summary ?? null;

  const visible = useMemo(() => {
    const byStatus =
      filter === "all" ? rows : rows.filter((r) => r.status === filter);
    const q = query.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter(
      (r) =>
        r.page.toLowerCase().includes(q) ||
        r.topQueries.some((tq) => tq.query.toLowerCase().includes(q)),
    );
  }, [rows, filter, query]);

  const clicksDeltaPct = useMemo(() => {
    if (!summary || summary.prevTotalClicks === 0) return null;
    return Math.round(
      ((summary.totalClicks - summary.prevTotalClicks) /
        summary.prevTotalClicks) *
        100,
    );
  }, [summary]);

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

  const filters: { key: AuditPageRow["status"] | "all"; label: string }[] = [
    { key: "decay", label: `Menurun (${summary?.decayed ?? 0})` },
    { key: "rising", label: `Naik (${summary?.rising ?? 0})` },
    { key: "fresh", label: `Baru (${summary?.fresh ?? 0})` },
    { key: "stable", label: `Stabil (${summary?.stable ?? 0})` },
    { key: "all", label: "Semua" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Ringkasan audit terakhir */}
      {summary && !busy ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          <div className="bento-tile border-transparent bg-teal-600 shadow-md shadow-teal-600/20 dark:bg-teal-500">
            <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
              Klik {latest!.windowDays} hari
            </span>
            <span className="bento-value text-white dark:text-teal-950">
              {summary.totalClicks.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium text-teal-100/90 dark:text-teal-900/80">
              data nyata Search Console
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Periode sebelumnya</span>
            <span className="bento-value">
              {summary.prevTotalClicks.toLocaleString("id-ID")}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              {clicksDeltaPct == null ? (
                "pembanding 28 hari sebelumnya"
              ) : clicksDeltaPct >= 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  ▲{clicksDeltaPct}% vs periode ini
                </span>
              ) : (
                <span className="text-rose-600 dark:text-rose-400">
                  ▼{Math.abs(clicksDeltaPct)}% vs periode ini
                </span>
              )}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Halaman menurun</span>
            <span
              className={cn(
                "bento-value",
                summary.decayed > 0 && "text-rose-600 dark:text-rose-400",
              )}
            >
              {summary.decayed}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              prioritas untuk di-refresh
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Naik · Baru</span>
            <span className="flex items-baseline gap-3">
              <span className="bento-value text-emerald-600 dark:text-emerald-400">
                ▲{summary.rising}
              </span>
              <span className="bento-value text-sky-600 dark:text-sky-400">
                +{summary.fresh}
              </span>
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              halaman naik & pendatang baru
            </span>
          </div>
        </div>
      ) : null}

      <section className={cn(lab.section, lab.entrance)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={lab.sectionTitle}>Audit Search Console</h2>
            <p className={lab.sectionDesc}>
              {latest
                ? `${latest.siteUrl} · jendela ${latest.windowDays} hari vs ${latest.windowDays} hari sebelumnya.`
                : "Jalankan audit pertama untuk melihat halaman yang trafiknya menurun."}
            </p>
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
          <div className={cn(lab.card, "p-0")}>
            {/* Toolbar tabel */}
            <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-foreground font-bold tracking-tight">
                  Halaman
                </p>
                <p className="text-muted-foreground text-xs">
                  {visible.length === rows.length
                    ? `${rows.length} halaman`
                    : `${visible.length} dari ${rows.length} halaman`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                <div className="relative">
                  <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cari halaman atau query…"
                    className="h-9 w-52 pl-8 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
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
                              {row.page.replace(/^https?:\/\/[^/]+/, "") ||
                                row.page}
                            </span>
                            <ExternalLink className="size-3 shrink-0" />
                          </a>
                          <span
                            className={cn(
                              "mt-1 inline-flex w-fit items-center rounded-lg px-2 py-0.5 text-[10px] font-bold",
                              meta.className,
                            )}
                          >
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
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                              <ArrowUpRight className="size-3" />
                              {row.deltaPct}%
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
                              <ArrowDownRight className="size-3" />
                              {row.deltaPct}%
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex max-w-56 flex-wrap gap-1">
                            {row.topQueries.length === 0 ? (
                              <span className="text-muted-foreground text-xs">
                                —
                              </span>
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
          </div>
        )}
      </section>
    </div>
  );
}
