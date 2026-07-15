"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import { ArrowUpRight, Bug, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { LabEmptyState, lab } from "@/components/lab/lab-primitives";
import {
  SEO_STATUS_LABELS,
  isSeoStatusBusy,
  scoreToneClass,
} from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createSeoSiteCrawl,
  deleteSeoSiteCrawl,
} from "@/actions/seo-crawler";
import { cn } from "@/lib/utils";
import { useSeoCrawlPolling } from "@/hooks/use-seo-crawl-polling";

export type CrawlRow = {
  id: string;
  name: string;
  domain: string;
  status: SeoAnalysisStatus;
  pagesCrawled: number;
  maxPages: number;
  includeLighthouse: boolean;
  issueCount: number;
  healthScore: number | null;
  errorMessage: string | null;
  createdAt: string;
};

export type CrawlerSummary = {
  totalCrawls: number;
  totalDomains: number;
  lastHealthScore: number | null;
  lastReadyIssues: number | null;
  runningCrawls: number;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Pill status crawl: emerald siap, amber (pulse) berjalan, rose gagal. */
function CrawlStatusPill({ status }: { status: SeoAnalysisStatus }) {
  const busy = isSeoStatusBusy(status);
  const ready = status === SeoAnalysisStatus.READY;
  const failed = status === SeoAnalysisStatus.FAILED;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        ready
          ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
          : failed
            ? "bg-rose-500/12 text-rose-700 dark:text-rose-300"
            : busy
              ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
              : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          ready
            ? "bg-emerald-500"
            : failed
              ? "bg-rose-500"
              : busy
                ? "animate-pulse bg-amber-500"
                : "bg-muted-foreground/50",
        )}
      />
      {SEO_STATUS_LABELS[status]}
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

export function CrawlerClient({
  crawls,
  summary,
}: {
  crawls: CrawlRow[];
  summary: CrawlerSummary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(crawls.length === 0);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [maxPages, setMaxPages] = useState("100");
  const [lighthouse, setLighthouse] = useState(false);

  const busyCrawlIds = crawls
    .filter((crawl) => isSeoStatusBusy(crawl.status))
    .map((crawl) => crawl.id);
  useSeoCrawlPolling(busyCrawlIds);

  function handleCreate() {
    if (!name.trim() || !domain.trim()) {
      toast.error("Nama dan domain wajib diisi.");
      return;
    }
    const parsedMax = Math.min(1000, Math.max(1, Number(maxPages) || 100));
    startTransition(async () => {
      try {
        await createSeoSiteCrawl({
          name: name.trim(),
          domain: domain.trim(),
          maxPages: parsedMax,
          includeLighthouse: lighthouse,
        });
        setName("");
        setDomain("");
        setMaxPages("100");
        setLighthouse(false);
        setFormOpen(false);
        toast.success("Crawl dimulai — berjalan di background (cek berkala).");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memulai crawl."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSeoSiteCrawl(id);
        toast.success("Crawl dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Ringkasan crawl */}
      {crawls.length > 0 ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          <div className="bento-tile border-transparent bg-teal-600 shadow-md shadow-teal-600/20 dark:bg-teal-500">
            <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
              Total crawl
            </span>
            <span className="bento-value text-white dark:text-teal-950">
              {summary.totalCrawls}
            </span>
            <span className="text-[11px] font-medium text-teal-100/90 dark:text-teal-900/80">
              di {summary.totalDomains} domain
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Health score terakhir</span>
            <span
              className={cn(
                "bento-value",
                scoreToneClass(summary.lastHealthScore),
              )}
            >
              {summary.lastHealthScore ?? "—"}
              {summary.lastHealthScore != null ? (
                <span className="text-muted-foreground/60 text-lg font-bold">
                  /100
                </span>
              ) : null}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              dari crawl siap terbaru
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Isu ditemukan</span>
            <span className="bento-value">
              {summary.lastReadyIssues ?? "—"}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              pada crawl terakhir yang siap
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Crawl berjalan</span>
            <span
              className={cn(
                "bento-value",
                summary.runningCrawls > 0 &&
                  "text-amber-600 dark:text-amber-400",
              )}
            >
              {summary.runningCrawls}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              {summary.runningCrawls > 0
                ? "halaman ter-update otomatis"
                : "tidak ada proses aktif"}
            </span>
          </div>
        </div>
      ) : null}

      {/* Riwayat crawl + toggle form */}
      <section className={cn(lab.section, lab.entrance)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={lab.sectionTitle}>Riwayat crawl</h2>
            <p className={lab.sectionDesc}>
              {crawls.length === 0
                ? "Mulai crawl teknis pertama Anda di bawah."
                : `${crawls.length} crawl · isu disusun berdasarkan prioritas.`}
            </p>
          </div>
          {crawls.length > 0 ? (
            <Button
              variant={formOpen ? "outline" : "default"}
              onClick={() => setFormOpen((v) => !v)}
            >
              {formOpen ? <X /> : <Plus />}
              {formOpen ? "Tutup" : "Crawl baru"}
            </Button>
          ) : null}
        </div>

        {/* Form crawl baru (collapsible) */}
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
                Crawl baru
              </p>
              <p className="text-muted-foreground text-sm">
                Crawl berjalan di DataForSEO (beberapa menit). Halaman akan
                ter-update saat selesai.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Nama</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="mis. Audit teknis brandanda.com"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Domain</Label>
                <Input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="brandanda.com"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Maks. halaman</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={maxPages}
                  onChange={(e) => setMaxPages(e.target.value)}
                  disabled={pending}
                />
              </div>
              <label className="flex items-center gap-2 self-end pb-1.5 text-sm">
                <Checkbox
                  checked={lighthouse}
                  onCheckedChange={(v) => setLighthouse(v === true)}
                  disabled={pending}
                />
                Sertakan Core Web Vitals (Lighthouse)
              </label>
            </div>
            <div>
              <Button onClick={handleCreate} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Plus />}
                Mulai crawl
              </Button>
            </div>
          </div>
        ) : null}

        {/* Kartu crawl */}
        {crawls.length === 0 ? (
          <LabEmptyState
            icon={Bug}
            title="Belum ada crawl"
            description="Mulai crawl teknis pertama di atas — broken link, meta duplikat, status code, dan Core Web Vitals dicek otomatis."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {crawls.map((c) => (
              <div key={c.id} className={cn(lab.card, "group flex flex-col p-0")}>
                <Link
                  href={`/seo/crawler/${c.id}`}
                  className="flex flex-1 flex-col gap-4 p-5 pb-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {c.healthScore != null ? (
                        <span
                          className={cn(
                            "bg-muted/60 flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold tabular-nums",
                            scoreToneClass(c.healthScore),
                          )}
                          title="Health score"
                          aria-hidden
                        >
                          {c.healthScore}
                        </span>
                      ) : (
                        <span
                          className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl"
                          aria-hidden
                        >
                          <Bug className="size-5" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                          <span className="truncate">{c.name}</span>
                          <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {c.domain}
                        </p>
                      </div>
                    </div>
                    <CrawlStatusPill status={c.status} />
                  </div>

                  {c.status === SeoAnalysisStatus.FAILED && c.errorMessage ? (
                    <p className="text-destructive line-clamp-2 text-xs">
                      {c.errorMessage}
                    </p>
                  ) : null}

                  <div className="grid grid-cols-3 gap-2">
                    <CardStat
                      label="Halaman"
                      value={
                        <>
                          {c.pagesCrawled}
                          <span className="text-muted-foreground/60 font-bold">
                            /{c.maxPages}
                          </span>
                        </>
                      }
                    />
                    <CardStat
                      label="Isu"
                      value={
                        c.issueCount > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            {c.issueCount}
                          </span>
                        ) : (
                          c.issueCount
                        )
                      }
                    />
                    <CardStat
                      label="Skor"
                      value={
                        c.healthScore != null ? (
                          <span className={scoreToneClass(c.healthScore)}>
                            {c.healthScore}
                          </span>
                        ) : (
                          "—"
                        )
                      }
                    />
                  </div>
                </Link>

                <div className="border-border/60 flex items-center justify-between gap-2 border-t px-3 py-2">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                    {formatDate(c.createdAt)}
                    {c.includeLighthouse ? (
                      <Badge variant="outline" className="text-[10px]">
                        CWV
                      </Badge>
                    ) : null}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(c.id)}
                    disabled={pending}
                    aria-label="Hapus crawl"
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
