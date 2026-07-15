"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import {
  ArrowUpRight,
  ListChecks,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabEmptyState, lab } from "@/components/lab/lab-primitives";
import {
  SEO_STATUS_LABELS,
  isSeoStatusBusy,
  scoreToneClass,
} from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createSeoOnPageAudit,
  deleteSeoOnPageAudit,
} from "@/actions/seo-onpage-audit";
import { cn } from "@/lib/utils";

export type AuditRow = {
  id: string;
  url: string;
  targetKeyword: string | null;
  status: SeoAnalysisStatus;
  score: number | null;
  errorMessage: string | null;
  createdAt: string;
};

export type AuditListSummary = {
  total: number;
  ready: number;
  busy: number;
  failed: number;
  avgScore: number | null;
  bestScore: number | null;
  lastCreatedAt: string | null;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Pill status audit: hijau siap, amber berdenyut saat proses, rose gagal. */
function StatusPill({ status }: { status: SeoAnalysisStatus }) {
  const busy = isSeoStatusBusy(status);
  const failed = status === SeoAnalysisStatus.FAILED;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        failed
          ? "bg-rose-500/12 text-rose-700 dark:text-rose-300"
          : busy
            ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
            : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          failed
            ? "bg-rose-500"
            : busy
              ? "animate-pulse bg-amber-500"
              : "bg-emerald-500",
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

export function OnPageAuditClient({
  audits,
  summary,
}: {
  audits: AuditRow[];
  summary: AuditListSummary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(audits.length === 0);
  const [url, setUrl] = useState("");
  const [keyword, setKeyword] = useState("");

  const hasBusy = audits.some((a) => isSeoStatusBusy(a.status));
  useEffect(() => {
    if (!hasBusy) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [hasBusy, router]);

  function handleCreate() {
    if (!url.trim()) {
      toast.error("URL wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await createSeoOnPageAudit({
          url: url.trim(),
          targetKeyword: keyword.trim() || undefined,
        });
        setUrl("");
        setKeyword("");
        setFormOpen(false);
        toast.success("Audit dimulai — berjalan di background.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memulai audit."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSeoOnPageAudit(id);
        toast.success("Audit dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Ringkasan audit */}
      {audits.length > 0 ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          <div className="bento-tile border-transparent bg-teal-600 shadow-md shadow-teal-600/20 dark:bg-teal-500">
            <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
              Total audit
            </span>
            <span className="bento-value text-white dark:text-teal-950">
              {summary.total}
            </span>
            <span className="text-[11px] font-medium text-teal-100/90 dark:text-teal-900/80">
              {summary.ready} siap · {summary.busy} berjalan
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Skor rata-rata</span>
            <span className={cn("bento-value", scoreToneClass(summary.avgScore))}>
              {summary.avgScore ?? "—"}
              {summary.avgScore != null ? (
                <span className="text-muted-foreground/60 text-lg font-bold">
                  /100
                </span>
              ) : null}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              dari audit yang siap
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Skor terbaik</span>
            <span className={cn("bento-value", scoreToneClass(summary.bestScore))}>
              {summary.bestScore ?? "—"}
              {summary.bestScore != null ? (
                <span className="text-muted-foreground/60 text-lg font-bold">
                  /100
                </span>
              ) : null}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              halaman paling optimal
            </span>
          </div>

          {summary.failed > 0 ? (
            <div className="bento-tile border-transparent bg-[#fbdcd7] dark:bg-rose-400/10">
              <span className="text-[11.5px] font-semibold text-rose-800/70 dark:text-rose-200/60">
                Audit gagal
              </span>
              <span className="bento-value text-rose-900 dark:text-rose-300">
                {summary.failed}
              </span>
              <span className="text-[11px] font-medium text-rose-800/60 dark:text-rose-200/50">
                buka untuk lihat penyebabnya
              </span>
            </div>
          ) : (
            <div className="bento-tile">
              <span className="bento-label">Terakhir dibuat</span>
              <span className="bento-value text-2xl">
                {summary.lastCreatedAt
                  ? new Date(summary.lastCreatedAt).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                    })
                  : "—"}
              </span>
              <span className="text-muted-foreground text-[11px] font-medium">
                tidak ada audit gagal
              </span>
            </div>
          )}
        </div>
      ) : null}

      {/* Riwayat audit + toggle form */}
      <section className={cn(lab.section, lab.entrance)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={lab.sectionTitle}>Riwayat audit</h2>
            <p className={lab.sectionDesc}>
              {audits.length === 0
                ? "Mulai audit pertama Anda di bawah."
                : `${audits.length} audit · skor + rekomendasi actionable per URL.`}
            </p>
          </div>
          {audits.length > 0 ? (
            <Button
              variant={formOpen ? "outline" : "default"}
              onClick={() => setFormOpen((v) => !v)}
            >
              {formOpen ? <X /> : <Plus />}
              {formOpen ? "Tutup" : "Audit baru"}
            </Button>
          ) : null}
        </div>

        {/* Form audit baru (collapsible) */}
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
                Audit baru
              </p>
              <p className="text-muted-foreground text-sm">
                Masukkan URL halaman sendiri. Opsional: keyword target untuk
                analisis penggunaan keyword.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="grid gap-1.5">
                <Label>URL halaman</Label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://brandanda.com/produk/serum"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Keyword target (opsional)</Label>
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="serum vitamin c"
                  disabled={pending}
                />
              </div>
              <Button onClick={handleCreate} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Plus />}
                Audit
              </Button>
            </div>
          </div>
        ) : null}

        {/* Kartu audit */}
        {audits.length === 0 ? (
          <LabEmptyState
            icon={ListChecks}
            title="Belum ada audit"
            description="Mulai audit pertama dengan memasukkan URL di atas."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {audits.map((a) => (
              <div
                key={a.id}
                className={cn(lab.card, "group flex flex-col p-0")}
              >
                <Link
                  href={`/seo/onpage-audit/${a.id}`}
                  className="flex flex-1 flex-col gap-4 p-5 pb-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "border-border/60 flex size-10 shrink-0 items-center justify-center rounded-xl border text-base font-extrabold tabular-nums",
                          scoreToneClass(a.score),
                        )}
                        aria-hidden
                      >
                        {a.score ?? "—"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                          <span className="truncate">
                            {a.url.replace(/^https?:\/\//, "")}
                          </span>
                          <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {a.targetKeyword
                            ? `keyword: ${a.targetKeyword}`
                            : "tanpa keyword target"}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={a.status} />
                  </div>

                  {a.status === SeoAnalysisStatus.FAILED && a.errorMessage ? (
                    <p className="text-destructive truncate text-xs">
                      {a.errorMessage}
                    </p>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2">
                    <CardStat
                      label="Skor on-page"
                      value={
                        a.score != null ? (
                          <span className={scoreToneClass(a.score)}>
                            {a.score}/100
                          </span>
                        ) : (
                          "—"
                        )
                      }
                    />
                    <CardStat
                      label="Keyword target"
                      value={a.targetKeyword ?? "—"}
                    />
                  </div>
                </Link>

                <div className="border-border/60 flex items-center justify-between gap-2 border-t px-3 py-2">
                  <span className="text-muted-foreground text-xs">
                    {formatDateTime(a.createdAt)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(a.id)}
                    disabled={pending}
                    aria-label="Hapus audit"
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
