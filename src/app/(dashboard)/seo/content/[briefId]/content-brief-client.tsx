"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import { ArrowLeft, FileText, Loader2, PenLine, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SeoDetailPage } from "@/components/seo/seo-module-page";
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import {
  ResearchHubEmptyState,
  hub,
} from "@/components/research-hub/research-hub-primitives";
import { isSeoStatusBusy, scoreToneClass } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import { generateDraftFromBriefAction } from "@/actions/seo-content";
import { cn } from "@/lib/utils";

export type BriefDetail = {
  id: string;
  title: string;
  targetKeyword: string;
  status: SeoAnalysisStatus;
  angle: string | null;
  relatedKeywords: string[];
  outline: { heading: string; points: string[] }[];
  errorMessage: string | null;
  drafts: { id: string; title: string; score: number | null }[];
};

export function ContentBriefClient({ brief }: { brief: BriefDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);

  const busy = isSeoStatusBusy(brief.status);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [busy, router]);

  function handleGenerateDraft() {
    setGenerating(true);
    startTransition(async () => {
      try {
        const { draftId } = await generateDraftFromBriefAction(brief.id);
        toast.success("Draft selesai ditulis.");
        router.push(`/seo/content/draft/${draftId}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menulis draft."));
        setGenerating(false);
      }
    });
  }

  return (
    <SeoDetailPage
      icon={FileText}
      title={brief.title}
      description={`Keyword target: "${brief.targetKeyword}"`}
      right={
        <div className="flex items-center gap-2">
          <SeoStatusBadge status={brief.status} />
          <Button
            onClick={handleGenerateDraft}
            disabled={pending || generating || busy}
            size="sm"
          >
            {generating ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Tulis draft
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/seo/content" />}>
            <ArrowLeft />
            Kembali
          </Button>
        </div>
      }
    >
      {brief.status === SeoAnalysisStatus.FAILED && brief.errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {brief.errorMessage}
        </div>
      ) : null}

      {busy ? (
        <ResearchHubEmptyState
          icon={FileText}
          title="Menyusun brief…"
          description="LLM sedang menyusun outline & related keywords. Halaman ter-update otomatis."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <div className="flex flex-col gap-5">
            {brief.angle ? (
              <div className={hub.panel}>
                <p className={cn(hub.label, "mb-2")}>Angle</p>
                <p className="text-sm leading-relaxed">{brief.angle}</p>
              </div>
            ) : null}

            <div className={cn(hub.card, "p-4")}>
              <p className="mb-3 font-semibold">Outline</p>
              {brief.outline.length === 0 ? (
                <p className="text-muted-foreground text-sm">Belum ada outline.</p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {brief.outline.map((section, i) => (
                    <li key={i}>
                      <p className="font-medium">
                        {i + 1}. {section.heading}
                      </p>
                      {section.points.length > 0 ? (
                        <ul className="text-muted-foreground ml-5 mt-1 list-disc text-sm">
                          {section.points.map((p, j) => (
                            <li key={j}>{p}</li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className={cn(hub.card, "p-4")}>
              <p className="mb-2 font-semibold">Draft dari brief ini</p>
              {brief.drafts.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Belum ada draft. Klik “Tulis draft” untuk menghasilkan artikel.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {brief.drafts.map((d) => (
                    <Link
                      key={d.id}
                      href={`/seo/content/draft/${d.id}`}
                      className={cn(hub.nestedPanel, "flex items-center gap-3 hover:border-primary/40")}
                    >
                      <span
                        className={cn(
                          "flex size-8 items-center justify-center rounded-lg border text-xs font-bold tabular-nums",
                          scoreToneClass(d.score),
                        )}
                      >
                        {d.score ?? "—"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {d.title}
                      </span>
                      <PenLine className="text-muted-foreground size-4" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={cn(hub.card, "h-fit p-4")}>
            <p className="mb-2 font-semibold">Related keywords</p>
            {brief.relatedKeywords.length === 0 ? (
              <p className="text-muted-foreground text-sm">—</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {brief.relatedKeywords.map((k) => (
                  <Badge key={k} variant="outline">
                    {k}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </SeoDetailPage>
  );
}
