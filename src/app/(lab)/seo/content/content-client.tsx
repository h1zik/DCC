"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  Loader2,
  PenLine,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LabEmptyState, lab } from "@/components/lab/lab-primitives";
import {
  SEO_STATUS_LABELS,
  isSeoStatusBusy,
  scoreToneClass,
} from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createBlankDraft,
  createContentBrief,
  deleteContentBrief,
  deleteContentDraft,
} from "@/actions/seo-content";
import { cn } from "@/lib/utils";

export type BriefRow = {
  id: string;
  targetKeyword: string;
  title: string;
  status: SeoAnalysisStatus;
  errorMessage: string | null;
  createdAt: string;
  draftCount: number;
};

export type DraftRow = {
  id: string;
  title: string;
  targetKeyword: string | null;
  score: number | null;
  updatedAt: string;
};

export type ContentSummary = {
  totalBriefs: number;
  readyBriefs: number;
  busyBriefs: number;
  totalDrafts: number;
  avgDraftScore: number | null;
  publishReadyDrafts: number;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });
}

/** Pill status brief ala StatusDot rank-tracker (emerald siap, amber berdenyut saat proses, rose gagal). */
function StatusPill({ status }: { status: SeoAnalysisStatus }) {
  const busy = isSeoStatusBusy(status);
  const tone =
    status === SeoAnalysisStatus.READY
      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
      : status === SeoAnalysisStatus.FAILED
        ? "bg-rose-500/12 text-rose-700 dark:text-rose-300"
        : "bg-amber-500/12 text-amber-700 dark:text-amber-300";
  const dot =
    status === SeoAnalysisStatus.READY
      ? "bg-emerald-500"
      : status === SeoAnalysisStatus.FAILED
        ? "bg-rose-500"
        : "bg-amber-500 animate-pulse";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot)} />
      {SEO_STATUS_LABELS[status]}
      {busy ? "…" : ""}
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

export function ContentClient({
  briefs,
  drafts,
  summary,
}: {
  briefs: BriefRow[];
  drafts: DraftRow[];
  summary: ContentSummary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(
    briefs.length === 0 && drafts.length === 0,
  );
  const [keyword, setKeyword] = useState("");
  const [briefTitle, setBriefTitle] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftKeyword, setDraftKeyword] = useState("");

  const hasBusy = briefs.some((b) => isSeoStatusBusy(b.status));
  useEffect(() => {
    if (!hasBusy) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [hasBusy, router]);

  function handleCreateBrief() {
    if (!keyword.trim() || !briefTitle.trim()) {
      toast.error("Keyword target dan judul wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await createContentBrief({
          targetKeyword: keyword.trim(),
          title: briefTitle.trim(),
        });
        setKeyword("");
        setBriefTitle("");
        setFormOpen(false);
        toast.success("Brief dibuat — outline dibuat di background.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat brief."));
      }
    });
  }

  function handleCreateBlankDraft() {
    if (!draftTitle.trim()) {
      toast.error("Judul draft wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        const { draftId } = await createBlankDraft({
          title: draftTitle.trim(),
          targetKeyword: draftKeyword.trim() || undefined,
        });
        toast.success("Draft dibuat.");
        router.push(`/seo/content/draft/${draftId}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat draft."));
      }
    });
  }

  function handleDeleteBrief(id: string) {
    startTransition(async () => {
      try {
        await deleteContentBrief(id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus brief."));
      }
    });
  }

  function handleDeleteDraft(id: string) {
    startTransition(async () => {
      try {
        await deleteContentDraft(id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus draft."));
      }
    });
  }

  const hasContent = briefs.length > 0 || drafts.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Ringkasan pipeline konten */}
      {hasContent ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          <div className="bento-tile border-transparent bg-teal-600 shadow-md shadow-teal-600/20 dark:bg-teal-500">
            <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
              Brief konten
            </span>
            <span className="bento-value text-white dark:text-teal-950">
              {summary.totalBriefs}
            </span>
            <span className="text-[11px] font-medium text-teal-100/90 dark:text-teal-900/80">
              {summary.readyBriefs} siap
              {summary.busyBriefs > 0
                ? ` · ${summary.busyBriefs} diproses`
                : ""}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Draft artikel</span>
            <span className="bento-value">{summary.totalDrafts}</span>
            <span className="text-muted-foreground text-[11px] font-medium">
              di editor konten
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Skor rata-rata</span>
            <span className="bento-value">
              {summary.avgDraftScore != null ? summary.avgDraftScore : "—"}
              {summary.avgDraftScore != null ? (
                <span className="text-muted-foreground/60 text-lg font-bold">
                  /100
                </span>
              ) : null}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              draft yang sudah dianalisis
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
            <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
              Siap terbit
            </span>
            <span className="bento-value text-violet-950 dark:text-violet-200">
              {summary.publishReadyDrafts}
            </span>
            <span className="text-[11px] font-medium text-violet-700/70 dark:text-violet-300/70">
              draft dengan skor ≥ 80
            </span>
          </div>
        </div>
      ) : null}

      {/* CTA Topic Discovery */}
      <Link
        href="/seo/content/discover"
        className={cn(
          lab.entrance,
          "bento-tile group flex-row items-center gap-4 border-primary/25",
        )}
      >
        <span className="bg-primary/12 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-foreground flex items-center gap-2 font-bold tracking-tight">
            Mulai dari Topic Discovery
            <Badge variant="secondary">Disarankan</Badge>
          </span>
          <span className="text-muted-foreground mt-0.5 block text-sm leading-relaxed">
            Cukup masukkan kategori → AI usulkan keyword + judul ter-grounding
            data (volume, difficulty, intent, tren), diurut opportunity. Tanpa
            tebak-tebak keyword sendiri.
          </span>
        </span>
        <ArrowRight
          className="text-muted-foreground size-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
          aria-hidden
        />
      </Link>

      {/* Header + toggle form buat baru */}
      <section className={cn(lab.section, lab.entrance)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={lab.sectionTitle}>Brief & draft</h2>
            <p className={lab.sectionDesc}>
              {hasContent
                ? `${briefs.length} brief · ${drafts.length} draft dalam pipeline konten.`
                : "Mulai dengan brief atau draft pertama Anda di bawah."}
            </p>
          </div>
          {hasContent ? (
            <Button
              variant={formOpen ? "outline" : "default"}
              onClick={() => setFormOpen((v) => !v)}
            >
              {formOpen ? <X /> : <Plus />}
              {formOpen ? "Tutup" : "Buat baru"}
            </Button>
          ) : null}
        </div>

        {formOpen ? (
          <div
            className={cn(
              "grid gap-4 md:grid-cols-2",
              "animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none",
            )}
          >
            <div className={cn(lab.panel, "flex flex-col gap-3")}>
              <div>
                <p className="text-foreground font-bold tracking-tight">
                  Brief dari keyword
                </p>
                <p className="text-muted-foreground text-sm">
                  Riset SERP + outline dibuat otomatis di background.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label>Keyword target</Label>
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="serum vitamin c"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Judul kerja</Label>
                <Input
                  value={briefTitle}
                  onChange={(e) => setBriefTitle(e.target.value)}
                  placeholder="Panduan Memilih Serum Vitamin C"
                  disabled={pending}
                />
              </div>
              <Button onClick={handleCreateBrief} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Plus />}
                Buat brief & outline
              </Button>
            </div>

            <div className={cn(lab.panel, "flex flex-col gap-3")}>
              <div>
                <p className="text-foreground font-bold tracking-tight">
                  Draft langsung
                </p>
                <p className="text-muted-foreground text-sm">
                  Lewati brief — langsung menulis di editor dengan skor
                  real-time.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label>Judul</Label>
                <Input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Judul artikel"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Keyword target (opsional)</Label>
                <Input
                  value={draftKeyword}
                  onChange={(e) => setDraftKeyword(e.target.value)}
                  placeholder="serum vitamin c"
                  disabled={pending}
                />
              </div>
              <Button
                variant="outline"
                onClick={handleCreateBlankDraft}
                disabled={pending}
              >
                <PenLine />
                Tulis draft kosong
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {/* Kartu brief */}
      <section className={cn(lab.section, lab.entrance)}>
        <div>
          <h2 className={lab.sectionTitle}>Brief</h2>
          <p className={lab.sectionDesc}>
            {briefs.length === 0
              ? "Belum ada brief."
              : `${briefs.length} brief · outline grounded SERP Google.co.id.`}
          </p>
        </div>
        {briefs.length === 0 ? (
          <LabEmptyState
            icon={FileText}
            title="Belum ada brief"
            description="Buat brief dari keyword target lewat tombol “Buat baru” di atas."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {briefs.map((b) => (
              <div key={b.id} className={cn(lab.card, "group flex flex-col p-0")}>
                <Link
                  href={`/seo/content/${b.id}`}
                  className="flex flex-1 flex-col gap-4 p-5 pb-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl"
                        aria-hidden
                      >
                        <FileText className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                          <span className="truncate">{b.title}</span>
                          <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          keyword: {b.targetKeyword}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={b.status} />
                  </div>

                  {b.status === SeoAnalysisStatus.FAILED && b.errorMessage ? (
                    <p className="text-destructive line-clamp-2 text-xs">
                      {b.errorMessage}
                    </p>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2">
                    <CardStat label="Draft dihasilkan" value={b.draftCount} />
                    <CardStat label="Dibuat" value={formatDate(b.createdAt)} />
                  </div>
                </Link>

                <div className="border-border/60 flex items-center justify-between gap-2 border-t px-3 py-2">
                  <span className="text-muted-foreground truncate text-xs">
                    “{b.targetKeyword}”
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDeleteBrief(b.id)}
                    disabled={pending}
                    aria-label="Hapus brief"
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Kartu draft */}
      <section className={cn(lab.section, lab.entrance)}>
        <div>
          <h2 className={lab.sectionTitle}>Draft</h2>
          <p className={lab.sectionDesc}>
            {drafts.length === 0
              ? "Belum ada draft."
              : `${drafts.length} draft · skor real-time ala Surfer di editor.`}
          </p>
        </div>
        {drafts.length === 0 ? (
          <LabEmptyState
            icon={PenLine}
            title="Belum ada draft"
            description="Buat draft kosong, atau hasilkan dari brief."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {drafts.map((d) => (
              <div key={d.id} className={cn(lab.card, "group flex flex-col p-0")}>
                <Link
                  href={`/seo/content/draft/${d.id}`}
                  className="flex flex-1 flex-col gap-4 p-5 pb-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold tabular-nums",
                          scoreToneClass(d.score),
                        )}
                        title="Skor SEO"
                      >
                        {d.score ?? "—"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                          <span className="truncate">{d.title}</span>
                          <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {d.targetKeyword
                            ? `keyword: ${d.targetKeyword}`
                            : "tanpa keyword"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <CardStat
                      label="Skor SEO"
                      value={
                        d.score != null ? (
                          <span className={scoreToneClass(d.score)}>
                            {d.score}/100
                          </span>
                        ) : (
                          "—"
                        )
                      }
                    />
                    <CardStat
                      label="Diperbarui"
                      value={formatDate(d.updatedAt)}
                    />
                  </div>
                </Link>

                <div className="border-border/60 flex items-center justify-between gap-2 border-t px-3 py-2">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                    <PenLine className="size-3.5" aria-hidden />
                    Editor konten
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDeleteDraft(d.id)}
                    disabled={pending}
                    aria-label="Hapus draft"
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
