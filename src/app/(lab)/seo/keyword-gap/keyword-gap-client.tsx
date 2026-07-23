"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import {
  ArrowUpRight,
  Loader2,
  Plus,
  Swords,
  Trash2,
  TriangleAlert,
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
  createSeoKeywordGap,
  deleteSeoKeywordGap,
} from "@/actions/seo-keyword-gap";
import { cn } from "@/lib/utils";

export type KeywordGapRow = {
  id: string;
  name: string;
  target: string;
  competitors: string[];
  status: SeoAnalysisStatus;
  missing: number | null;
  weak: number | null;
  needsRefresh: boolean;
  errorMessage: string | null;
  createdAt: string;
};

export type KeywordGapListSummary = {
  total: number;
  ready: number;
  busy: number;
  failed: number;
  missing: number;
  weak: number;
  lastCreatedAt: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });
}

/** Pill status analisis: hijau siap, amber berdenyut saat proses, rose gagal. */
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

export function KeywordGapClient({
  items,
  summary,
  prefillTarget,
  prefillCompetitor,
}: {
  items: KeywordGapRow[];
  summary: KeywordGapListSummary;
  prefillTarget: string;
  prefillCompetitor: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(items.length === 0);
  const [name, setName] = useState("");
  const [target, setTarget] = useState(prefillTarget);
  const [competitors, setCompetitors] = useState(prefillCompetitor);

  const hasBusy = items.some((i) => isSeoStatusBusy(i.status));
  useEffect(() => {
    if (!hasBusy) return;
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 4000);
    return () => clearInterval(timer);
  }, [hasBusy, router]);

  function handleCreate() {
    const compList = competitors
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!target.trim() || compList.length === 0) {
      toast.error("Domain target & minimal satu kompetitor wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        const { id } = await createSeoKeywordGap({
          name: name.trim() || `${target.trim()} vs ${compList[0]}`,
          target: target.trim(),
          competitors: compList.slice(0, 3),
        });
        setName("");
        setFormOpen(false);
        toast.success("Analisis keyword gap dimulai.");
        router.push(`/seo/keyword-gap/${id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memulai analisis."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSeoKeywordGap(id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Ringkasan portofolio gap */}
      {items.length > 0 ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          <div className="bento-tile border-transparent bg-teal-600 shadow-md shadow-teal-600/20 dark:bg-teal-500">
            <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
              Analisis gap
            </span>
            <span className="bento-value text-white dark:text-teal-950">
              {summary.total}
            </span>
            <span className="text-[11px] font-medium text-teal-100/90 dark:text-teal-900/80">
              {summary.ready} siap · {summary.busy} berjalan
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Keyword missing</span>
            <span className="bento-value text-rose-600 dark:text-rose-400">
              {summary.missing.toLocaleString("id-ID")}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              peluang prioritas dari analisis siap
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Keyword weak</span>
            <span className="bento-value text-amber-600 dark:text-amber-400">
              {summary.weak.toLocaleString("id-ID")}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              ranking di bawah semua kompetitor
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Terakhir dibuat</span>
            <span className="bento-value text-2xl">
              {formatDate(summary.lastCreatedAt)}
            </span>
            <span
              className={cn(
                "text-[11px] font-medium",
                summary.failed > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-muted-foreground",
              )}
            >
              {summary.failed > 0
                ? `${summary.failed} analisis gagal`
                : "semua analisis berjalan normal"}
            </span>
          </div>
        </div>
      ) : null}

      {/* Daftar analisis + toggle form */}
      <section className={cn(lab.section, lab.entrance)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={lab.sectionTitle}>Analisis keyword gap</h2>
            <p className={lab.sectionDesc}>
              {items.length === 0
                ? "Mulai dengan analisis pertama Anda di bawah."
                : `${items.length} analisis · bandingkan domain Anda vs hingga 3 kompetitor.`}
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
                Bandingkan keyword organik domain Anda dengan kompetitor —
                temukan missing, weak, untapped, dan kekuatan unik.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>Nama analisis (opsional)</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Gap vs kompetitor utama"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Domain Anda</Label>
                <Input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="brandanda.com"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Kompetitor (maks 3, pisah koma)</Label>
                <Input
                  value={competitors}
                  onChange={(e) => setCompetitors(e.target.value)}
                  placeholder="komp-a.com, komp-b.co.id"
                  disabled={pending}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleCreate} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Swords />}
                Analisis gap
              </Button>
            </div>
          </div>
        ) : null}

        {/* Kartu analisis */}
        {items.length === 0 ? (
          <LabEmptyState
            icon={Swords}
            title="Belum ada analisis gap"
            description="Bandingkan domain Anda dengan kompetitor untuk menemukan keyword yang belum Anda garap."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(lab.card, "group flex flex-col p-0")}
              >
                <Link
                  href={`/seo/keyword-gap/${item.id}`}
                  className="flex flex-1 flex-col gap-4 p-5 pb-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl"
                        aria-hidden
                      >
                        <Swords className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                          <span className="truncate">{item.name}</span>
                          <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {item.target} vs {item.competitors.join(", ")}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={item.status} />
                  </div>

                  {item.needsRefresh ? (
                    <p className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                      <TriangleAlert className="size-3.5 shrink-0" />
                      Hasil mesin lama — buka lalu klik Refresh.
                    </p>
                  ) : null}
                  {item.status === SeoAnalysisStatus.FAILED &&
                  item.errorMessage ? (
                    <p className="text-destructive truncate text-xs">
                      {item.errorMessage}
                    </p>
                  ) : null}

                  <div className="grid grid-cols-3 gap-2">
                    <CardStat
                      label="Missing"
                      value={
                        item.missing != null ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            {item.missing.toLocaleString("id-ID")}
                          </span>
                        ) : (
                          "—"
                        )
                      }
                    />
                    <CardStat
                      label="Weak"
                      value={
                        item.weak != null ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            {item.weak.toLocaleString("id-ID")}
                          </span>
                        ) : (
                          "—"
                        )
                      }
                    />
                    <CardStat label="Kompetitor" value={item.competitors.length} />
                  </div>
                </Link>

                <div className="border-border/60 flex items-center justify-between gap-2 border-t px-3 py-2">
                  <span className="text-muted-foreground text-xs">
                    Dibuat{" "}
                    {new Date(item.createdAt).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(item.id)}
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
