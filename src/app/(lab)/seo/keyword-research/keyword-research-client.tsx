"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import { ArrowUpRight, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabEmptyState, lab } from "@/components/lab/lab-primitives";
import { SEO_STATUS_LABELS, isSeoStatusBusy } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createSeoKeywordProject,
  deleteSeoKeywordProject,
} from "@/actions/seo-keyword-research";
import { cn } from "@/lib/utils";

export type KeywordProjectRow = {
  id: string;
  name: string;
  seedKeyword: string;
  status: SeoAnalysisStatus;
  keywordCount: number;
  dataNotice: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type KeywordPortfolioSummary = {
  totalProjects: number;
  readyProjects: number;
  busyProjects: number;
  totalKeywords: number;
};

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

export function KeywordResearchClient({
  projects,
  summary,
}: {
  projects: KeywordProjectRow[];
  summary: KeywordPortfolioSummary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(projects.length === 0);
  const [name, setName] = useState("");
  const [seed, setSeed] = useState("");
  const [description, setDescription] = useState("");

  // Auto-refresh selama ada proyek yang masih berproses.
  const hasBusy = projects.some((p) => isSeoStatusBusy(p.status));
  useEffect(() => {
    if (!hasBusy) return;
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 4000);
    return () => clearInterval(timer);
  }, [hasBusy, router]);

  function handleCreate() {
    if (!name.trim() || !seed.trim()) {
      toast.error("Nama proyek dan seed keyword wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await createSeoKeywordProject({
          name: name.trim(),
          seedKeyword: seed.trim(),
          description: description.trim() || undefined,
        });
        setName("");
        setSeed("");
        setDescription("");
        setFormOpen(false);
        toast.success("Proyek dibuat — riset berjalan di background.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat proyek."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSeoKeywordProject(id);
        toast.success("Proyek dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus proyek."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Ringkasan portofolio riset */}
      {projects.length > 0 ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          <div className="bento-tile border-transparent bg-teal-600 shadow-md shadow-teal-600/20 dark:bg-teal-500">
            <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
              Keyword terkumpul
            </span>
            <span className="bento-value text-white dark:text-teal-950">
              {summary.totalKeywords.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium text-teal-100/90 dark:text-teal-900/80">
              dari {summary.totalProjects} proyek riset
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Proyek siap</span>
            <span className="bento-value">
              {summary.readyProjects}
              <span className="text-muted-foreground/60 text-lg font-bold">
                {" "}
                / {summary.totalProjects}
              </span>
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              selesai diriset & di-cluster
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Sedang diriset</span>
            <span
              className={cn(
                "bento-value",
                summary.busyProjects > 0 &&
                  "text-amber-600 dark:text-amber-400",
              )}
            >
              {summary.busyProjects}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              berjalan di background
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Rata-rata keyword</span>
            <span className="bento-value">
              {summary.totalProjects > 0
                ? Math.round(
                    summary.totalKeywords / summary.totalProjects,
                  ).toLocaleString("id-ID")
                : "—"}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              per proyek riset
            </span>
          </div>
        </div>
      ) : null}

      {/* Header daftar proyek + toggle form */}
      <section className={cn(lab.section, lab.entrance)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={lab.sectionTitle}>Proyek keyword</h2>
            <p className={lab.sectionDesc}>
              {projects.length === 0
                ? "Mulai dengan seed keyword pertama Anda di bawah."
                : `${projects.length} proyek · ${summary.totalKeywords.toLocaleString("id-ID")} keyword Indonesia terkumpul.`}
            </p>
          </div>
          {projects.length > 0 ? (
            <Button
              variant={formOpen ? "outline" : "default"}
              onClick={() => setFormOpen((v) => !v)}
            >
              {formOpen ? <X /> : <Plus />}
              {formOpen ? "Tutup" : "Proyek baru"}
            </Button>
          ) : null}
        </div>

        {/* Form proyek baru (collapsible) */}
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
                Proyek baru
              </p>
              <p className="text-muted-foreground text-sm">
                Masukkan seed keyword (mis. nama kategori produk). Kami ambil
                keyword turunan + metrik lalu cluster otomatis.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Nama proyek</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="mis. Serum Vitamin C"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Seed keyword</Label>
                <Input
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="mis. serum vitamin c"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Catatan (opsional)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Konteks singkat proyek riset ini…"
                  disabled={pending}
                  rows={2}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">
                Riset berjalan di background — hasil muncul otomatis di daftar.
              </p>
              <Button onClick={handleCreate} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Plus />}
                Buat & riset
              </Button>
            </div>
          </div>
        ) : null}

        {/* Kartu proyek */}
        {projects.length === 0 ? (
          <LabEmptyState
            icon={Search}
            title="Belum ada proyek"
            description="Buat proyek pertama dengan seed keyword di atas — volume, difficulty, CPC, dan intent terkumpul otomatis."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className={cn(lab.card, "group flex flex-col p-0")}
              >
                <Link
                  href={`/seo/keyword-research/${p.id}`}
                  className="flex flex-1 flex-col gap-4 p-5 pb-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-extrabold uppercase"
                        aria-hidden
                      >
                        {p.name.trim().charAt(0) || "?"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                          <span className="truncate">{p.name}</span>
                          <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          seed: {p.seedKeyword}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={p.status} />
                  </div>

                  {p.status === SeoAnalysisStatus.FAILED && p.errorMessage ? (
                    <p className="text-destructive line-clamp-2 text-xs">
                      {p.errorMessage}
                    </p>
                  ) : null}
                  {p.dataNotice ? (
                    <p className="text-muted-foreground line-clamp-2 text-xs">
                      {p.dataNotice}
                    </p>
                  ) : null}

                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <CardStat
                      label="Keyword"
                      value={p.keywordCount.toLocaleString("id-ID")}
                    />
                    <CardStat label="Status" value={SEO_STATUS_LABELS[p.status]} />
                  </div>
                </Link>

                <div className="border-border/60 flex items-center justify-between gap-2 border-t px-3 py-2">
                  <span className="text-muted-foreground text-xs">
                    Dibuat {formatDate(p.createdAt)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(p.id)}
                    disabled={pending}
                    aria-label="Hapus proyek"
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
