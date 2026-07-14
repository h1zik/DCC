"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Loader2,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import {
  deleteContentIdeaSet,
  markContentIdeaUsed,
  refreshContentIdeaSet,
  setContentIdeaFeedback,
} from "@/actions/content-studio-ideas";
import { Button } from "@/components/ui/button";
import { lab } from "@/components/lab/lab-primitives";
import {
  IdeaSetStatusBadge,
  isIdeaSetBusy,
} from "../idea-status-badge";
import { cn } from "@/lib/utils";

const SOURCE_LABELS: Record<string, string> = {
  brand_voice: "Brand Voice",
  reviews: "Review Intel",
  ad_library: "Ad Library",
  trends: "Trend Radar",
  topic: "Topik",
};

type Citation = { source: string; text: string };

type Idea = {
  id: string;
  title: string;
  angle: string;
  format: string | null;
  hook: string | null;
  platform: string | null;
  cta: string | null;
  score: number | null;
  feedback: "UP" | "DOWN" | null;
  used: boolean;
  citations: Citation[];
};

type SetData = {
  id: string;
  name: string;
  topic: string;
  goal: string | null;
  status: string;
  platforms: string[];
  groundingSources: string[];
  dataNotice: string | null;
  aiSummary: string | null;
  errorMessage: string | null;
  brandName: string | null;
};

export function IdeaSetDetailClient({
  set,
  ideas,
}: {
  set: SetData;
  ideas: Idea[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const busy = isIdeaSetBusy(set.status);

  // Polling saat generate masih berjalan di background.
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [busy, router]);

  function handleRefresh() {
    startTransition(async () => {
      await refreshContentIdeaSet(set.id);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm("Hapus set ide ini?")) return;
    startTransition(async () => {
      await deleteContentIdeaSet(set.id);
      router.push("/content-studio/ideas");
    });
  }

  return (
    <div className={lab.page}>
      <header className={cn(lab.card, "p-5 sm:p-6")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-foreground text-lg font-semibold">
                {set.name}
              </h1>
              <IdeaSetStatusBadge status={set.status} />
            </div>
            <p className="text-muted-foreground mt-1 text-sm">{set.topic}</p>
            <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {set.brandName ? <span>Brand: {set.brandName}</span> : null}
              {set.goal ? <span>· Tujuan: {set.goal}</span> : null}
              {set.platforms.length > 0 ? (
                <span>· {set.platforms.join(", ")}</span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={pending || busy}
            >
              <RefreshCw className={cn("size-4", pending && "animate-spin")} />
              Regenerate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={pending}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        {set.aiSummary ? (
          <p className="text-muted-foreground mt-3 text-sm">{set.aiSummary}</p>
        ) : null}

        {set.groundingSources.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground text-xs">Grounding:</span>
            {set.groundingSources.map((g) => (
              <span
                key={g}
                className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[11px] font-medium"
              >
                {SOURCE_LABELS[g] ?? g}
              </span>
            ))}
          </div>
        ) : null}

        {set.dataNotice ? (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
            {set.dataNotice}
          </p>
        ) : null}
      </header>

      {busy ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/15 px-5 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Mengumpulkan sinyal nyata brand &amp; menyusun ide… halaman ini
          memperbarui sendiri.
        </div>
      ) : null}

      {set.status === "FAILED" ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-6 text-sm text-red-700 dark:text-red-300">
          <p className="font-semibold">Gagal generate ide</p>
          <p className="mt-1">{set.errorMessage ?? "Terjadi kesalahan."}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={handleRefresh}
            disabled={pending}
          >
            <RefreshCw className="size-4" />
            Coba lagi
          </Button>
        </div>
      ) : null}

      {!busy && ideas.length > 0 ? (
        <div className="grid gap-3">
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} disabled={pending} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function IdeaCard({ idea, disabled }: { idea: Idea; disabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function setFeedback(next: "UP" | "DOWN") {
    const value = idea.feedback === next ? null : next;
    startTransition(async () => {
      await setContentIdeaFeedback({ ideaId: idea.id, feedback: value });
      router.refresh();
    });
  }

  function toggleUsed() {
    startTransition(async () => {
      await markContentIdeaUsed({ ideaId: idea.id, used: !idea.used });
      router.refresh();
    });
  }

  async function copy() {
    const lines = [
      idea.title,
      idea.hook ? `\nHook: ${idea.hook}` : "",
      `\n${idea.angle}`,
      idea.cta ? `\nCTA: ${idea.cta}` : "",
    ].join("");
    try {
      await navigator.clipboard.writeText(lines.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* abaikan */
    }
  }

  const isDisabled = disabled || pending;

  return (
    <article
      className={cn(
        lab.card,
        "p-4 sm:p-5",
        idea.used && "border-emerald-500/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {typeof idea.score === "number" ? (
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                idea.score >= 75
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : idea.score >= 60
                    ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                    : "bg-muted text-muted-foreground",
              )}
              title="Skor ketajaman (self-critique)"
            >
              {idea.score}
            </span>
          ) : null}
          {idea.format ? (
            <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-[11px]">
              {idea.format}
            </span>
          ) : null}
          {idea.platform ? (
            <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-[11px]">
              {idea.platform}
            </span>
          ) : null}
          {idea.used ? (
            <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 rounded-md px-1.5 py-0.5 text-[11px] font-medium">
              Dipakai
            </span>
          ) : null}
        </div>
      </div>

      <h3 className="text-foreground mt-2 font-semibold">{idea.title}</h3>
      {idea.hook ? (
        <p className="text-foreground/90 mt-1.5 border-l-2 border-primary/40 pl-3 text-sm italic">
          “{idea.hook}”
        </p>
      ) : null}
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        {idea.angle}
      </p>
      {idea.cta ? (
        <p className="text-foreground mt-2 text-sm">
          <span className="text-muted-foreground">CTA:</span> {idea.cta}
        </p>
      ) : null}

      {idea.citations.length > 0 ? (
        <div className="mt-3 rounded-lg border border-border/40 bg-muted/20 p-3">
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
            Berakar pada
          </p>
          <ul className="mt-1.5 space-y-1">
            {idea.citations.map((c, i) => (
              <li key={i} className="text-xs leading-relaxed">
                <span className="text-primary font-medium">
                  {SOURCE_LABELS[c.source] ?? c.source}:
                </span>{" "}
                <span className="text-muted-foreground">{c.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFeedback("UP")}
          disabled={isDisabled}
          aria-pressed={idea.feedback === "UP"}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
            idea.feedback === "UP"
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-border text-muted-foreground hover:border-foreground/30",
          )}
        >
          <ThumbsUp className="size-3.5" /> Bagus
        </button>
        <button
          type="button"
          onClick={() => setFeedback("DOWN")}
          disabled={isDisabled}
          aria-pressed={idea.feedback === "DOWN"}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
            idea.feedback === "DOWN"
              ? "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300"
              : "border-border text-muted-foreground hover:border-foreground/30",
          )}
        >
          <ThumbsDown className="size-3.5" /> Kurang
        </button>
        <button
          type="button"
          onClick={toggleUsed}
          disabled={isDisabled}
          aria-pressed={idea.used}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
            idea.used
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-border text-muted-foreground hover:border-foreground/30",
          )}
        >
          <Check className="size-3.5" /> {idea.used ? "Dipakai" : "Tandai dipakai"}
        </button>
        <button
          type="button"
          onClick={copy}
          className="text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Tersalin" : "Salin"}
        </button>
      </div>
    </article>
  );
}
