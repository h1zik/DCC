"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import { ArrowRight, FileText, Loader2, PenLine, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  LabEmptyState,
  LabSection,
  lab,
} from "@/components/lab/lab-primitives";
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import { isSeoStatusBusy, scoreToneClass } from "@/lib/seo/labels";
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
};

export type DraftRow = {
  id: string;
  title: string;
  targetKeyword: string | null;
  score: number | null;
  updatedAt: string;
};

export function ContentClient({
  briefs,
  drafts,
}: {
  briefs: BriefRow[];
  drafts: DraftRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
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

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/seo/content/discover"
        className={cn(
          lab.card,
          lab.cardHover,
          "flex items-center gap-4 border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-5",
        )}
      >
        <span className="bg-primary/15 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/25">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-foreground font-semibold">
            Mulai dari Topic Discovery
            <Badge variant="secondary" className="ml-2 align-middle">
              Disarankan
            </Badge>
          </p>
          <p className="text-muted-foreground text-sm">
            Cukup masukkan kategori → AI usulkan keyword + judul ter-grounding
            data (volume, difficulty, intent, tren), diurut opportunity. Tanpa
            tebak-tebak keyword sendiri.
          </p>
        </div>
        <ArrowRight className="text-muted-foreground size-5 shrink-0" aria-hidden />
      </Link>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={cn(lab.panel, "flex flex-col gap-3")}>
          <p className="font-semibold">Brief dari keyword</p>
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
          <p className="font-semibold">Draft langsung</p>
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
          <Button variant="outline" onClick={handleCreateBlankDraft} disabled={pending}>
            <PenLine />
            Tulis draft kosong
          </Button>
        </div>
      </div>

      <LabSection title="Brief" description={`${briefs.length} brief.`}>
        {briefs.length === 0 ? (
          <LabEmptyState
            icon={FileText}
            title="Belum ada brief"
            description="Buat brief dari keyword target di atas."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {briefs.map((b) => (
              <div key={b.id} className={cn(lab.card, "flex flex-col gap-2 p-4")}>
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/seo/content/${b.id}`} className="min-w-0 flex-1">
                    <p className="text-foreground truncate font-semibold hover:underline">
                      {b.title}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      keyword: {b.targetKeyword}
                    </p>
                  </Link>
                  <SeoStatusBadge status={b.status} />
                </div>
                {b.status === SeoAnalysisStatus.FAILED && b.errorMessage ? (
                  <p className="text-destructive text-xs">{b.errorMessage}</p>
                ) : null}
                <div className="mt-auto flex justify-end">
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
      </LabSection>

      <LabSection title="Draft" description={`${drafts.length} draft.`}>
        {drafts.length === 0 ? (
          <LabEmptyState
            icon={PenLine}
            title="Belum ada draft"
            description="Buat draft kosong, atau hasilkan dari brief."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {drafts.map((d) => (
              <div key={d.id} className={cn(lab.card, "flex items-center gap-3 p-3")}>
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold tabular-nums",
                    scoreToneClass(d.score),
                  )}
                >
                  {d.score ?? "—"}
                </div>
                <Link href={`/seo/content/draft/${d.id}`} className="min-w-0 flex-1">
                  <p className="text-foreground truncate font-medium hover:underline">
                    {d.title}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {d.targetKeyword ? `keyword: ${d.targetKeyword}` : "tanpa keyword"}
                  </p>
                </Link>
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
            ))}
          </div>
        )}
      </LabSection>
    </div>
  );
}
