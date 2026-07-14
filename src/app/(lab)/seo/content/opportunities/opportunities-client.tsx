"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  SeoKeywordIntent,
  SeoOpportunityStage,
  SeoOpportunityType,
} from "@prisma/client";
import {
  ExternalLink,
  FileText,
  Lightbulb,
  Loader2,
  PenLine,
  RefreshCw,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import {
  LabEmptyState,
  lab,
} from "@/components/lab/lab-primitives";
import { SEO_INTENT_LABELS, scoreToneClass } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createBriefFromOpportunity,
  dismissOpportunity,
  refreshOpportunitiesAction,
  restoreOpportunity,
} from "@/actions/seo-content-opportunities";
import { cn } from "@/lib/utils";

export type OpportunityRow = {
  id: string;
  keyword: string;
  type: SeoOpportunityType;
  stage: SeoOpportunityStage;
  searchVolume: number | null;
  difficulty: number | null;
  intent: SeoKeywordIntent;
  opportunityScore: number;
  clusterLabel: string | null;
  currentPosition: number | null;
  targetUrl: string | null;
  suggestedTitle: string | null;
  angle: string | null;
  publishedUrl: string | null;
  briefId: string | null;
  draftId: string | null;
  lastRefreshedAt: string;
};

const STAGE_LABELS: Record<SeoOpportunityStage, string> = {
  IDEA: "Ide",
  BRIEFED: "Brief",
  DRAFTED: "Draft",
  PUBLISHED: "Terbit",
  DISMISSED: "Diabaikan",
};

const STAGE_BADGE: Record<
  SeoOpportunityStage,
  "default" | "secondary" | "destructive" | "outline"
> = {
  IDEA: "outline",
  BRIEFED: "secondary",
  DRAFTED: "secondary",
  PUBLISHED: "default",
  DISMISSED: "outline",
};

type Filter = "all" | "new" | "optimize" | "dismissed";

export function OpportunitiesClient({ items }: { items: OpportunityRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    return items.filter((i) => {
      if (filter === "dismissed") return i.stage === "DISMISSED";
      if (i.stage === "DISMISSED") return false;
      if (filter === "new") return i.type === "NEW_ARTICLE";
      if (filter === "optimize") return i.type === "OPTIMIZE_EXISTING";
      return true;
    });
  }, [items, filter]);

  const clusters = useMemo(() => {
    const map = new Map<string, OpportunityRow[]>();
    for (const item of visible) {
      const key = item.clusterLabel ?? "Lainnya";
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()].sort(
      (a, b) =>
        Math.max(...b[1].map((i) => i.opportunityScore)) -
        Math.max(...a[1].map((i) => i.opportunityScore)),
    );
  }, [visible]);

  function handleRefresh() {
    setRefreshing(true);
    startTransition(async () => {
      try {
        await refreshOpportunitiesAction();
        toast.success(
          "Refresh dimulai — feed ter-update dari riset keyword & rank tracker.",
        );
        setTimeout(() => {
          router.refresh();
          setRefreshing(false);
        }, 4000);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh."));
        setRefreshing(false);
      }
    });
  }

  function handleCreateBrief(item: OpportunityRow) {
    setActingId(item.id);
    startTransition(async () => {
      try {
        const { briefId } = await createBriefFromOpportunity(item.id);
        toast.success("Brief dibuat — riset SERP berjalan.");
        router.push(`/seo/content/${briefId}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat brief."));
        setActingId(null);
      }
    });
  }

  function handleDismiss(item: OpportunityRow) {
    setActingId(item.id);
    startTransition(async () => {
      try {
        await dismissOpportunity(item.id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengabaikan."));
      } finally {
        setActingId(null);
      }
    });
  }

  function handleRestore(item: OpportunityRow) {
    setActingId(item.id);
    startTransition(async () => {
      try {
        await restoreOpportunity(item.id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengembalikan."));
      } finally {
        setActingId(null);
      }
    });
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "Semua" },
    { key: "new", label: "Artikel baru" },
    { key: "optimize", label: "Optimasi" },
    { key: "dismissed", label: "Diabaikan" },
  ];

  return (
    <SeoModulePage
      icon={Lightbulb}
      title="Content Opportunities"
      description="Rekomendasi artikel dari AI yang membaca riset keyword & posisi ranking Anda — diurutkan dari peluang terbaik."
      right={
        <Button size="sm" onClick={handleRefresh} disabled={pending || refreshing}>
          {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Refresh feed
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <LabEmptyState
          icon={Lightbulb}
          title="Belum ada opportunity"
          description="Jalankan riset keyword atau tambah keyword ke rank tracker, lalu klik “Refresh feed”. Feed juga ter-update otomatis tiap hari setelah rank sync."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {clusters.map(([cluster, rows]) => (
            <div key={cluster}>
              <p className={cn(lab.label, "mb-2")}>{cluster}</p>
              <div className="flex flex-col gap-2">
                {rows.map((item) => (
                  <div
                    key={item.id}
                    className={cn(lab.card, "flex flex-col gap-2 p-4")}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg border text-sm font-bold tabular-nums",
                          scoreToneClass(item.opportunityScore),
                        )}
                      >
                        {Math.round(item.opportunityScore)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {item.suggestedTitle ?? item.keyword}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {item.keyword}
                          {item.angle ? ` — ${item.angle}` : ""}
                        </p>
                      </div>
                      <Badge
                        variant={
                          item.type === "OPTIMIZE_EXISTING" ? "default" : "secondary"
                        }
                      >
                        {item.type === "OPTIMIZE_EXISTING"
                          ? `Optimasi — posisi #${item.currentPosition ?? "?"}`
                          : "Artikel baru"}
                      </Badge>
                      <Badge variant={STAGE_BADGE[item.stage]}>
                        {STAGE_LABELS[item.stage]}
                      </Badge>
                    </div>

                    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span>Vol: {item.searchVolume ?? "—"}</span>
                      <span>KD: {item.difficulty ?? "—"}</span>
                      <span>{SEO_INTENT_LABELS[item.intent]}</span>
                      {item.targetUrl ? (
                        <a
                          href={item.targetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-60 items-center gap-1 truncate hover:underline"
                        >
                          <ExternalLink className="size-3" />
                          {item.targetUrl.replace(/^https?:\/\//, "")}
                        </a>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {item.stage === "DISMISSED" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestore(item)}
                          disabled={pending && actingId === item.id}
                        >
                          <Undo2 />
                          Kembalikan
                        </Button>
                      ) : item.briefId ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            render={<Link href={`/seo/content/${item.briefId}`} />}
                          >
                            <FileText />
                            Buka brief
                          </Button>
                          {item.draftId ? (
                            <Button
                              variant="outline"
                              size="sm"
                              render={
                                <Link href={`/seo/content/draft/${item.draftId}`} />
                              }
                            >
                              <PenLine />
                              Buka draft
                            </Button>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleCreateBrief(item)}
                            disabled={pending && actingId === item.id}
                          >
                            {pending && actingId === item.id ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <Sparkles />
                            )}
                            Buat brief
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDismiss(item)}
                            disabled={pending && actingId === item.id}
                          >
                            <X />
                            Abaikan
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </SeoModulePage>
  );
}
