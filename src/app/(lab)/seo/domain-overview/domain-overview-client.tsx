"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import {
  ArrowUpRight,
  Globe,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabEmptyState, lab } from "@/components/lab/lab-primitives";
import { SEO_STATUS_LABELS, isSeoStatusBusy } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createSeoDomainOverview,
  deleteSeoDomainOverview,
} from "@/actions/seo-domain-overview";
import { cn } from "@/lib/utils";

export type DomainOverviewRow = {
  id: string;
  target: string;
  status: SeoAnalysisStatus;
  organicTraffic: number | null;
  organicKeywords: number | null;
  errorMessage: string | null;
  createdAt: string;
};

export type DomainPortfolioSummary = {
  total: number;
  ready: number;
  busy: number;
  topTraffic: { target: string; value: number } | null;
  topKeywords: { target: string; value: number } | null;
  latest: { target: string; createdAt: string } | null;
};

const compactNumber = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Pill status analisis: siap → hijau, berproses → amber berdenyut, gagal → rose. */
function StatusPill({ status }: { status: SeoAnalysisStatus }) {
  const busy = isSeoStatusBusy(status);
  const ready = status === SeoAnalysisStatus.READY;
  const failed = status === SeoAnalysisStatus.FAILED;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        ready && "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
        busy && "bg-amber-500/12 text-amber-700 dark:text-amber-300",
        failed && "bg-rose-500/12 text-rose-700 dark:text-rose-300",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          ready && "bg-emerald-500",
          busy && "animate-pulse bg-amber-500",
          failed && "bg-rose-500",
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

export function DomainOverviewClient({
  items,
  summary,
}: {
  items: DomainOverviewRow[];
  summary: DomainPortfolioSummary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(items.length === 0);
  const [target, setTarget] = useState("");

  const hasBusy = items.some((i) => isSeoStatusBusy(i.status));
  useEffect(() => {
    if (!hasBusy) return;
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 4000);
    return () => clearInterval(timer);
  }, [hasBusy, router]);

  function handleCreate() {
    if (!target.trim()) {
      toast.error("Domain wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        const { id } = await createSeoDomainOverview({ target: target.trim() });
        setTarget("");
        setFormOpen(false);
        toast.success("Analisis domain dimulai.");
        router.push(`/seo/domain-overview/${id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memulai analisis."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSeoDomainOverview(id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Ringkasan portofolio analisis */}
      {items.length > 0 ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          <div className="bento-tile border-transparent bg-teal-600 shadow-md shadow-teal-600/20 dark:bg-teal-500">
            <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
              Domain dianalisis
            </span>
            <span className="bento-value text-white dark:text-teal-950">
              {summary.total}
            </span>
            <span className="text-[11px] font-medium text-teal-100/90 dark:text-teal-900/80">
              {summary.ready} siap
              {summary.busy > 0 ? ` · ${summary.busy} berproses` : ""}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Trafik tertinggi</span>
            <span className="bento-value">
              {summary.topTraffic
                ? compactNumber.format(summary.topTraffic.value)
                : "—"}
            </span>
            <span className="text-muted-foreground truncate text-[11px] font-medium">
              {summary.topTraffic
                ? `${summary.topTraffic.target} · est./bln`
                : "belum ada data"}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Keyword terbanyak</span>
            <span className="bento-value">
              {summary.topKeywords
                ? compactNumber.format(summary.topKeywords.value)
                : "—"}
            </span>
            <span className="text-muted-foreground truncate text-[11px] font-medium">
              {summary.topKeywords
                ? `${summary.topKeywords.target} · organik`
                : "belum ada data"}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Analisis terbaru</span>
            <span className="bento-value text-2xl">
              {summary.latest ? formatDate(summary.latest.createdAt) : "—"}
            </span>
            <span className="text-muted-foreground truncate text-[11px] font-medium">
              {summary.latest ? summary.latest.target : "belum ada analisis"}
            </span>
          </div>
        </div>
      ) : null}

      {/* Header daftar + toggle form */}
      <section className={cn(lab.section, lab.entrance)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={lab.sectionTitle}>Analisis domain</h2>
            <p className={lab.sectionDesc}>
              {items.length === 0
                ? "Mulai dengan domain pertama Anda di bawah."
                : `${items.length} domain · potret organik Google Indonesia.`}
            </p>
          </div>
          {items.length > 0 ? (
            <Button
              variant={formOpen ? "outline" : "default"}
              onClick={() => setFormOpen((v) => !v)}
            >
              {formOpen ? <X /> : <Plus />}
              {formOpen ? "Tutup" : "Analisis baru"}
            </Button>
          ) : null}
        </div>

        {/* Form analisis baru (collapsible) */}
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
                Analisis baru
              </p>
              <p className="text-muted-foreground text-sm">
                Masukkan domain apa pun untuk melihat estimasi trafik, keyword
                organik, dan kompetitor yang terdeteksi otomatis.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="grid gap-1.5">
                <Label>Domain (milik sendiri atau kompetitor)</Label>
                <Input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="mis. kompetitor.co.id"
                  disabled={pending}
                />
              </div>
              <Button onClick={handleCreate} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Search />}
                Analisis
              </Button>
            </div>
          </div>
        ) : null}

        {/* Kartu domain */}
        {items.length === 0 ? (
          <LabEmptyState
            icon={Globe}
            title="Belum ada analisis domain"
            description="Masukkan domain apa pun untuk melihat potret organiknya di Google Indonesia."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(lab.card, "group flex flex-col p-0")}
              >
                <Link
                  href={`/seo/domain-overview/${item.id}`}
                  className="flex flex-1 flex-col gap-4 p-5 pb-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl"
                        aria-hidden
                      >
                        <Globe className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                          <span className="truncate">{item.target}</span>
                          <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          Google Indonesia · organik
                        </p>
                      </div>
                    </div>
                    <StatusPill status={item.status} />
                  </div>

                  {item.status === SeoAnalysisStatus.FAILED &&
                  item.errorMessage ? (
                    <p className="text-destructive line-clamp-2 text-xs">
                      {item.errorMessage}
                    </p>
                  ) : null}

                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <CardStat
                      label="Trafik est./bln"
                      value={
                        item.organicTraffic != null
                          ? compactNumber.format(item.organicTraffic)
                          : "—"
                      }
                    />
                    <CardStat
                      label="Keyword organik"
                      value={
                        item.organicKeywords != null
                          ? item.organicKeywords.toLocaleString("id-ID")
                          : "—"
                      }
                    />
                  </div>
                </Link>

                <div className="border-border/60 flex items-center justify-between gap-2 border-t px-3 py-2">
                  <span className="text-muted-foreground text-xs">
                    Dianalisis {formatDate(item.createdAt)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(item.id)}
                    disabled={pending}
                    aria-label="Hapus"
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
