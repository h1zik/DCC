"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResearchMarketplace, SeoAnalysisStatus } from "@prisma/client";
import { ArrowUpRight, Loader2, Plus, Store, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { LabEmptyState, lab } from "@/components/lab/lab-primitives";
import {
  SEO_STATUS_LABELS,
  isSeoStatusBusy,
  scoreToneClass,
} from "@/lib/seo/labels";
import type { SelectItemDef } from "@/lib/select-option-items";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createSeoMarketplaceAnalysis,
  deleteSeoMarketplaceAnalysis,
} from "@/actions/seo-marketplace";
import { cn } from "@/lib/utils";

export const MARKETPLACE_LABELS: Record<string, string> = {
  SHOPEE: "Shopee",
  TOKOPEDIA: "Tokopedia",
  LAZADA: "Lazada",
};

const SUPPORTED = [
  ResearchMarketplace.SHOPEE,
  ResearchMarketplace.TOKOPEDIA,
  ResearchMarketplace.LAZADA,
];

const MARKETPLACE_ITEMS: SelectItemDef[] = SUPPORTED.map((m) => ({
  value: m,
  label: MARKETPLACE_LABELS[m],
}));

export type MarketplaceRow = {
  id: string;
  keyword: string;
  marketplace: ResearchMarketplace;
  status: SeoAnalysisStatus;
  optimizationScore: number | null;
  hasOwnTitle: boolean;
  errorMessage: string | null;
  createdAt: string;
};

export type MarketplaceSummary = {
  total: number;
  ready: number;
  busy: number;
  failed: number;
  /** Rata-rata skor optimasi judul (hanya analisis dengan judul sendiri). */
  avgScore: number | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Pill status dengan dot berwarna (amber berdenyut saat proses berjalan). */
function StatusPill({ status }: { status: SeoAnalysisStatus }) {
  const busy = isSeoStatusBusy(status);
  const tone =
    status === SeoAnalysisStatus.READY
      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
      : status === SeoAnalysisStatus.FAILED
        ? "bg-rose-500/12 text-rose-700 dark:text-rose-300"
        : busy
          ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
          : "bg-muted text-muted-foreground";
  const dot =
    status === SeoAnalysisStatus.READY
      ? "bg-emerald-500"
      : status === SeoAnalysisStatus.FAILED
        ? "bg-rose-500"
        : busy
          ? "animate-pulse bg-amber-500"
          : "bg-muted-foreground/50";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot)} />
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

export function MarketplaceClient({
  analyses,
  summary,
}: {
  analyses: MarketplaceRow[];
  summary: MarketplaceSummary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(analyses.length === 0);
  const [keyword, setKeyword] = useState("");
  const [marketplace, setMarketplace] = useState<ResearchMarketplace>(
    ResearchMarketplace.SHOPEE,
  );
  const [ownTitle, setOwnTitle] = useState("");

  const hasBusy = analyses.some((a) => isSeoStatusBusy(a.status));
  useEffect(() => {
    if (!hasBusy) return;
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 5000);
    return () => clearInterval(timer);
  }, [hasBusy, router]);

  function handleCreate() {
    if (!keyword.trim()) {
      toast.error("Keyword wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await createSeoMarketplaceAnalysis({
          keyword: keyword.trim(),
          marketplace,
          ownTitle: ownTitle.trim() || undefined,
        });
        setKeyword("");
        setOwnTitle("");
        setFormOpen(false);
        toast.success("Analisis dimulai — scraping berjalan di background.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memulai analisis."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSeoMarketplaceAnalysis(id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Ringkasan analisis */}
      {analyses.length > 0 ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          <div className="bento-tile border-transparent bg-teal-600 shadow-md shadow-teal-600/20 dark:bg-teal-500">
            <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
              Total analisis
            </span>
            <span className="bento-value text-white dark:text-teal-950">
              {summary.total}
            </span>
            <span className="text-[11px] font-medium text-teal-100/90 dark:text-teal-900/80">
              Shopee · Tokopedia · Lazada
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Siap dibuka</span>
            <span className="bento-value">{summary.ready}</span>
            <span className="text-muted-foreground text-[11px] font-medium">
              hasil analisis selesai
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Berjalan · Gagal</span>
            <span className="flex items-baseline gap-3">
              <span className="bento-value text-amber-600 dark:text-amber-400">
                {summary.busy}
              </span>
              <span className="bento-value text-rose-600 dark:text-rose-400">
                {summary.failed}
              </span>
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              status proses saat ini
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Skor judul rata-rata</span>
            <span className={cn("bento-value", scoreToneClass(summary.avgScore))}>
              {summary.avgScore ?? "—"}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              dari analisis dengan judul sendiri
            </span>
          </div>
        </div>
      ) : null}

      {/* Header riwayat + toggle form */}
      <section className={cn(lab.section, lab.entrance)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={lab.sectionTitle}>Riwayat analisis</h2>
            <p className={lab.sectionDesc}>
              {analyses.length === 0
                ? "Mulai analisis marketplace SEO pertama di bawah."
                : `${analyses.length} analisis keyword marketplace.`}
            </p>
          </div>
          {analyses.length > 0 ? (
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
                Masukkan keyword pencarian marketplace. Opsional: judul produkmu
                untuk skor optimasi.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Keyword</Label>
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="serum vitamin c"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Marketplace</Label>
                <Select
                  value={marketplace}
                  items={MARKETPLACE_ITEMS}
                  onValueChange={(v) => {
                    if (v) setMarketplace(v as ResearchMarketplace);
                  }}
                >
                  <SelectTrigger>{MARKETPLACE_LABELS[marketplace]}</SelectTrigger>
                  <SelectContent>
                    {SUPPORTED.map((m) => (
                      <SelectItem key={m} value={m}>
                        {MARKETPLACE_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Judul produk sendiri (opsional)</Label>
                <Input
                  value={ownTitle}
                  onChange={(e) => setOwnTitle(e.target.value)}
                  placeholder="Serum Vitamin C 20% Brightening Original BPOM 30ml"
                  disabled={pending}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">
                Listing teratas di-scrape otomatis — hasil muncul dalam
                beberapa menit.
              </p>
              <Button onClick={handleCreate} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Plus />}
                Analisis
              </Button>
            </div>
          </div>
        ) : null}

        {/* Kartu analisis */}
        {analyses.length === 0 ? (
          <LabEmptyState
            icon={Store}
            title="Belum ada analisis"
            description="Mulai analisis marketplace SEO pertama lewat form di atas."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {analyses.map((a) => (
              <div key={a.id} className={cn(lab.card, "group flex flex-col p-0")}>
                <Link
                  href={`/seo/marketplace/${a.id}`}
                  className="flex flex-1 flex-col gap-4 p-5 pb-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl"
                        aria-hidden
                      >
                        <Store className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                          <span className="truncate">{a.keyword}</span>
                          <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {MARKETPLACE_LABELS[a.marketplace] ?? a.marketplace}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={a.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <CardStat
                      label="Skor judul"
                      value={
                        a.hasOwnTitle ? (
                          <span className={scoreToneClass(a.optimizationScore)}>
                            {a.optimizationScore ?? "—"}
                          </span>
                        ) : (
                          "—"
                        )
                      }
                    />
                    <CardStat label="Dibuat" value={formatDate(a.createdAt)} />
                  </div>

                  {a.status === SeoAnalysisStatus.FAILED && a.errorMessage ? (
                    <p className="text-destructive line-clamp-2 text-xs">
                      {a.errorMessage}
                    </p>
                  ) : null}
                </Link>

                <div className="border-border/60 flex items-center justify-between gap-2 border-t px-3 py-2">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                    <Store className="size-3.5" aria-hidden />
                    {MARKETPLACE_LABELS[a.marketplace] ?? a.marketplace}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(a.id)}
                    disabled={pending}
                    aria-label="Hapus analisis"
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
