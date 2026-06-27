"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus, SeoKeywordIntent } from "@prisma/client";
import { Loader2, PenLine, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResearchHubEmptyState,
  ResearchHubSection,
  hub,
} from "@/components/research-hub/research-hub-primitives";
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import {
  SEO_INTENT_LABELS,
  isSeoStatusBusy,
  scoreToneClass,
} from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createTopicDiscovery,
  deleteTopicDiscovery,
} from "@/actions/seo-content-discovery";
import { createContentBrief } from "@/actions/seo-content";
import { cn } from "@/lib/utils";

type Suggestion = {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  intent: SeoKeywordIntent;
  opportunityScore: number;
  suggestedTitle: string;
  angle: string | null;
  competingTitles: string[];
};

export type DiscoveryRun = {
  id: string;
  seed: string;
  status: SeoAnalysisStatus;
  suggestions: Suggestion[];
  dataNotice: string | null;
  errorMessage: string | null;
  createdAt: string;
};

function num(v: number | null): string {
  return v == null ? "—" : v.toLocaleString("id-ID");
}

export function TopicDiscoveryClient({ runs }: { runs: DiscoveryRun[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [seed, setSeed] = useState("");
  const [creatingKw, setCreatingKw] = useState<string | null>(null);

  const hasBusy = runs.some((r) => isSeoStatusBusy(r.status));
  useEffect(() => {
    if (!hasBusy) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [hasBusy, router]);

  function handleDiscover() {
    if (!seed.trim()) {
      toast.error("Seed/kategori wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await createTopicDiscovery({ seed: seed.trim() });
        setSeed("");
        toast.success("Mencari topik — berjalan di background.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memulai discovery."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteTopicDiscovery(id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  function handleCreateBrief(s: Suggestion) {
    setCreatingKw(s.keyword);
    startTransition(async () => {
      try {
        const { id } = await createContentBrief({
          targetKeyword: s.keyword,
          title: s.suggestedTitle,
        });
        toast.success("Brief dibuat — menyusun outline.");
        router.push(`/seo/content/${id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat brief."));
        setCreatingKw(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <ResearchHubSection
        title="Temukan topik dari data"
        description="Cukup masukkan kategori/seed. Kami tarik keyword + metrik nyata, skor opportunity, dan usulkan judul yang grounding ke SERP."
      >
        <div className={cn(hub.panel, "grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end")}>
          <div className="grid gap-1.5">
            <Label>Seed / kategori</Label>
            <Input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="mis. parfum gen-z, serum vitamin c, sunscreen"
              disabled={pending}
            />
          </div>
          <Button onClick={handleDiscover} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Temukan topik
          </Button>
        </div>
      </ResearchHubSection>

      {runs.length === 0 ? (
        <ResearchHubEmptyState
          icon={Sparkles}
          title="Belum ada discovery"
          description="Masukkan satu kategori di atas untuk melihat keyword + judul ter-ranking."
        />
      ) : (
        runs.map((run) => (
          <div key={run.id} className={cn(hub.card, "p-4")}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold">“{run.seed}”</span>
                <SeoStatusBadge status={run.status} />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleDelete(run.id)}
                disabled={pending}
                aria-label="Hapus"
              >
                <Trash2 className="text-destructive" />
              </Button>
            </div>

            {run.status === SeoAnalysisStatus.FAILED && run.errorMessage ? (
              <p className="text-destructive text-sm">{run.errorMessage}</p>
            ) : null}
            {run.dataNotice ? (
              <p className="text-muted-foreground text-sm">{run.dataNotice}</p>
            ) : null}

            {isSeoStatusBusy(run.status) ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Menarik keyword, skor opportunity, & grounding SERP…
              </p>
            ) : run.suggestions.length === 0 && !run.dataNotice ? (
              <p className="text-muted-foreground text-sm">Tidak ada saran.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {run.suggestions.map((s) => (
                  <div
                    key={s.keyword}
                    className={cn(hub.nestedPanel, "flex flex-col gap-2 sm:flex-row sm:items-center")}
                  >
                    <div
                      className={cn(
                        "flex size-11 shrink-0 flex-col items-center justify-center rounded-xl border text-base font-bold tabular-nums",
                        scoreToneClass(s.opportunityScore),
                      )}
                      title="Opportunity score"
                    >
                      {s.opportunityScore}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground font-medium">{s.suggestedTitle}</p>
                      <p className="text-muted-foreground text-xs">
                        <span className="font-medium">{s.keyword}</span> · vol{" "}
                        {num(s.searchVolume)} · difficulty {s.difficulty ?? "—"} ·{" "}
                        {SEO_INTENT_LABELS[s.intent]}
                      </p>
                      {s.angle ? (
                        <p className="text-muted-foreground mt-0.5 text-xs italic">
                          {s.angle}
                        </p>
                      ) : null}
                      {s.competingTitles.length > 0 ? (
                        <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
                          Saingan: {s.competingTitles.slice(0, 2).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleCreateBrief(s)}
                      disabled={pending}
                      className="shrink-0"
                    >
                      {creatingKw === s.keyword ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <PenLine />
                      )}
                      Buat brief
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
