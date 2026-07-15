"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import { ArrowUpRight, Link2, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabEmptyState, lab } from "@/components/lab/lab-primitives";
import { SEO_STATUS_LABELS, isSeoStatusBusy } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createSeoBacklinkProfile,
  deleteSeoBacklinkProfile,
} from "@/actions/seo-backlinks";
import { cn } from "@/lib/utils";

export type BacklinkProfileRow = {
  id: string;
  name: string;
  target: string;
  status: SeoAnalysisStatus;
  backlinks: number | null;
  referringDomains: number | null;
  errorMessage: string | null;
  createdAt: string;
};

function num(value: number | null): string {
  return value == null ? "—" : value.toLocaleString("id-ID");
}

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

export function BacklinksClient({ profiles }: { profiles: BacklinkProfileRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(profiles.length === 0);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");

  const hasBusy = profiles.some((p) => isSeoStatusBusy(p.status));
  useEffect(() => {
    if (!hasBusy) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [hasBusy, router]);

  /* --------- Ringkasan portofolio (agregat dari data yang sudah ada) ---------- */
  const summary = useMemo(() => {
    let backlinks = 0;
    let hasBacklinkData = false;
    let referringDomains = 0;
    let hasRefData = false;
    let ready = 0;
    let busy = 0;
    let failed = 0;
    for (const p of profiles) {
      if (p.backlinks != null) {
        backlinks += p.backlinks;
        hasBacklinkData = true;
      }
      if (p.referringDomains != null) {
        referringDomains += p.referringDomains;
        hasRefData = true;
      }
      if (p.status === SeoAnalysisStatus.READY) ready += 1;
      else if (p.status === SeoAnalysisStatus.FAILED) failed += 1;
      else if (isSeoStatusBusy(p.status)) busy += 1;
    }
    return {
      backlinks: hasBacklinkData ? backlinks : null,
      referringDomains: hasRefData ? referringDomains : null,
      ready,
      busy,
      failed,
    };
  }, [profiles]);

  function handleCreate() {
    if (!name.trim() || !target.trim()) {
      toast.error("Nama dan target wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await createSeoBacklinkProfile({ name: name.trim(), target: target.trim() });
        setName("");
        setTarget("");
        setFormOpen(false);
        toast.success("Profil dibuat — analisis berjalan di background.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat profil."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSeoBacklinkProfile(id);
        toast.success("Profil dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Ringkasan portofolio backlink */}
      {profiles.length > 0 ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          <div className="bento-tile border-transparent bg-teal-600 shadow-md shadow-teal-600/20 dark:bg-teal-500">
            <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
              Total backlink
            </span>
            <span className="bento-value text-white dark:text-teal-950">
              {num(summary.backlinks)}
            </span>
            <span className="text-[11px] font-medium text-teal-100/90 dark:text-teal-900/80">
              dari {profiles.length} profil
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Referring domain</span>
            <span className="bento-value">{num(summary.referringDomains)}</span>
            <span className="text-muted-foreground text-[11px] font-medium">
              akumulasi semua profil
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Profil siap</span>
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
        </div>
      ) : null}

      {/* Header daftar profil + toggle form */}
      <section className={cn(lab.section, lab.entrance)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={lab.sectionTitle}>Profil backlink</h2>
            <p className={lab.sectionDesc}>
              {profiles.length === 0
                ? "Buat profil backlink pertama Anda di bawah."
                : `${profiles.length} profil domain dipantau.`}
            </p>
          </div>
          {profiles.length > 0 ? (
            <Button
              variant={formOpen ? "outline" : "default"}
              onClick={() => setFormOpen((v) => !v)}
            >
              {formOpen ? <X /> : <Plus />}
              {formOpen ? "Tutup" : "Analisis baru"}
            </Button>
          ) : null}
        </div>

        {/* Form profil baru (collapsible) */}
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
                Profil baru
              </p>
              <p className="text-muted-foreground text-sm">
                Masukkan domain (atau URL) milikmu untuk menganalisis profil
                backlink-nya.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="grid gap-1.5">
                <Label>Nama</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="mis. Brand Anda"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Domain / URL target</Label>
                <Input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="brandanda.com"
                  disabled={pending}
                />
              </div>
              <Button onClick={handleCreate} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Plus />}
                Analisis
              </Button>
            </div>
          </div>
        ) : null}

        {/* Kartu profil */}
        {profiles.length === 0 ? (
          <LabEmptyState
            icon={Link2}
            title="Belum ada profil"
            description="Buat profil backlink pertama lewat form di atas."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {profiles.map((p) => (
              <div key={p.id} className={cn(lab.card, "group flex flex-col p-0")}>
                <Link
                  href={`/seo/backlinks/${p.id}`}
                  className="flex flex-1 flex-col gap-4 p-5 pb-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl"
                        aria-hidden
                      >
                        <Link2 className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                          <span className="truncate">{p.name}</span>
                          <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {p.target}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={p.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <CardStat label="Backlink" value={num(p.backlinks)} />
                    <CardStat
                      label="Ref. domain"
                      value={num(p.referringDomains)}
                    />
                  </div>

                  {p.status === SeoAnalysisStatus.FAILED && p.errorMessage ? (
                    <p className="text-destructive line-clamp-2 text-xs">
                      {p.errorMessage}
                    </p>
                  ) : null}
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
                    aria-label="Hapus profil"
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
