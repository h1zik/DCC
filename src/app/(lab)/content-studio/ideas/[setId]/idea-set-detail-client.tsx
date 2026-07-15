"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  Lightbulb,
  Loader2,
  RefreshCw,
  Search,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { lab } from "@/components/lab/lab-primitives";
import type { SelectItemDef } from "@/lib/select-option-items";
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
  createdAt: string;
};

type SortKey = "score_desc" | "score_asc" | "title";

const SORT_ITEMS: SelectItemDef[] = [
  { value: "score_desc", label: "Skor tertinggi" },
  { value: "score_asc", label: "Skor terendah" },
  { value: "title", label: "Judul A–Z" },
];

/** Tone skor ketajaman: ≥80 emerald, ≥50 amber, sisanya rose. */
function scoreToneClass(score: number): string {
  if (score >= 80)
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (score >= 50) return "bg-amber-500/15 text-amber-800 dark:text-amber-300";
  return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
}

export function IdeaSetDetailClient({
  set,
  ideas,
}: {
  set: SetData;
  ideas: Idea[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("score_desc");
  const busy = isIdeaSetBusy(set.status);

  // Polling saat generate masih berjalan di background.
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [busy, router]);

  /* ------------------------------ Statistik hero ------------------------------ */
  const stats = useMemo(() => {
    const scores = ideas
      .map((i) => i.score)
      .filter((s): s is number => typeof s === "number");
    const avgScore = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;
    const topScore = scores.length ? Math.max(...scores) : null;
    const used = ideas.filter((i) => i.used).length;
    const up = ideas.filter((i) => i.feedback === "UP").length;
    const down = ideas.filter((i) => i.feedback === "DOWN").length;
    return { avgScore, topScore, used, up, down };
  }, [ideas]);

  /* --------------------------- Daftar: cari + sortir --------------------------- */
  const visibleIdeas = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = ideas.filter(
      (i) =>
        !q ||
        i.title.toLowerCase().includes(q) ||
        i.angle.toLowerCase().includes(q),
    );
    const score = (i: Idea) => i.score ?? -1;
    const sorted = [...list];
    switch (sortBy) {
      case "score_desc":
        sorted.sort((a, b) => score(b) - score(a));
        break;
      case "score_asc":
        sorted.sort((a, b) => score(a) - score(b));
        break;
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title, "id"));
        break;
    }
    return sorted;
  }, [ideas, query, sortBy]);

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

  const createdLabel = new Date(set.createdAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className={lab.page}>
      {/* Header detail: back link, judul + status, meta, aksi */}
      <header className={cn(lab.entrance, "relative isolate")}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-2">
            <Link
              href="/content-studio/ideas"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Semua set ide
            </Link>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-foreground text-balance text-2xl font-bold tracking-tight sm:text-3xl">
                {set.name}
              </h1>
              <IdeaSetStatusBadge status={set.status} />
            </div>
            <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed sm:text-[15px]">
              {set.topic}
            </p>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {set.brandName ? <span>Brand: {set.brandName}</span> : null}
              {set.goal ? <span>· Tujuan: {set.goal}</span> : null}
              {set.platforms.length > 0 ? (
                <span>· {set.platforms.join(", ")}</span>
              ) : null}
              <span>· Dibuat {createdLabel}</span>
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
              aria-label="Hapus set ide"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
        <div
          className="mt-5 h-px bg-gradient-to-r from-[color-mix(in_srgb,var(--lab-accent,var(--primary))_40%,transparent)] via-border to-transparent"
          aria-hidden
        />
      </header>

      {set.dataNotice ? (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
          {set.dataNotice}
        </p>
      ) : null}

      {busy ? (
        <div className="border-border/70 bg-card/40 text-muted-foreground flex items-center gap-3 rounded-2xl border border-dashed px-5 py-10 text-sm">
          <Loader2 className="text-amber-600 size-5 shrink-0 animate-spin dark:text-amber-400" />
          Mengumpulkan sinyal nyata brand &amp; menyusun ide… halaman ini
          memperbarui sendiri.
        </div>
      ) : null}

      {set.status === "FAILED" ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-6 text-sm text-rose-700 dark:text-rose-300">
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
        <>
          {/* Papan bento hero */}
          <div
            className={cn(
              lab.entrance,
              "grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 md:grid-cols-4",
            )}
          >
            {/* Total ide — tile hero amber, dua baris */}
            <div className="bento-tile row-span-2 border-transparent bg-amber-500 shadow-md shadow-amber-500/25 dark:bg-amber-400">
              <span className="text-[11.5px] font-semibold text-amber-100 dark:text-amber-950/70">
                Total ide
              </span>
              <span className="bento-value text-5xl text-white dark:text-amber-950">
                {ideas.length}
              </span>
              <span className="text-xs font-medium leading-snug text-amber-100/90 dark:text-amber-900/80">
                {set.groundingSources.length > 0
                  ? `grounded ${set.groundingSources.length} sumber sinyal nyata`
                  : "berbasis topik — pilih brand untuk grounding"}
              </span>
            </div>

            <div className="bento-tile">
              <span className="bento-label">Skor rata-rata</span>
              <span className="bento-value">
                {stats.avgScore ?? "—"}
                {stats.avgScore != null ? (
                  <span className="text-muted-foreground/60 text-lg font-bold">
                    /100
                  </span>
                ) : null}
              </span>
              <span className="text-muted-foreground text-[11px] font-medium">
                ketajaman via self-critique
              </span>
            </div>

            <div className="bento-tile">
              <span className="bento-label">Skor tertinggi</span>
              <span className="bento-value">
                {stats.topScore ?? "—"}
                {stats.topScore != null ? (
                  <span className="text-muted-foreground/60 text-lg font-bold">
                    /100
                  </span>
                ) : null}
              </span>
              <span className="text-muted-foreground text-[11px] font-medium">
                ide paling tajam di set ini
              </span>
            </div>

            {/* Ide dipakai — amber pastel */}
            <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
              <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
                Ide dipakai
              </span>
              <span className="bento-value text-amber-900 dark:text-amber-300">
                {stats.used}
                <span className="text-lg font-bold text-amber-800/50 dark:text-amber-300/50">
                  {" "}
                  / {ideas.length}
                </span>
              </span>
              <span className="text-[11px] font-medium text-amber-800/70 dark:text-amber-200/60">
                ditandai tim untuk produksi
              </span>
            </div>

            <div className="bento-tile">
              <span className="bento-label">Feedback tim</span>
              <span className="flex items-baseline gap-3">
                <span className="bento-value text-2xl text-emerald-600 dark:text-emerald-400">
                  ▲{stats.up}
                </span>
                <span className="bento-value text-2xl text-rose-600 dark:text-rose-400">
                  ▼{stats.down}
                </span>
              </span>
              <span className="text-muted-foreground text-[11px] font-medium">
                jadi contoh generasi berikutnya
              </span>
            </div>

            <div className="bento-tile">
              <span className="bento-label">Grounding</span>
              <span className="bento-value">
                {set.groundingSources.length || "—"}
              </span>
              <span className="text-muted-foreground truncate text-[11px] font-medium">
                {set.groundingSources.length > 0
                  ? set.groundingSources
                      .map((g) => SOURCE_LABELS[g] ?? g)
                      .join(", ")
                  : "hanya topik"}
              </span>
            </div>
          </div>

          {/* Ringkasan AI */}
          {set.aiSummary ? (
            <div className={cn(lab.entrance, "bento-tile justify-start gap-2")}>
              <span className="bento-label">Ringkasan AI</span>
              <p className="text-foreground/90 text-sm leading-relaxed">
                {set.aiSummary}
              </p>
            </div>
          ) : null}

          {/* Daftar ide + toolbar cari/sortir */}
          <section className={cn(lab.section, lab.entrance)}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className={lab.sectionTitle}>Daftar ide</h2>
                <p className={lab.sectionDesc}>
                  {visibleIdeas.length === ideas.length
                    ? `${ideas.length} ide ter-ranking berdasarkan skor ketajaman.`
                    : `${visibleIdeas.length} dari ${ideas.length} ide cocok dengan pencarian.`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cari judul atau angle…"
                    className="w-56 pl-8"
                  />
                </div>
                <Select
                  value={sortBy}
                  items={SORT_ITEMS}
                  onValueChange={(v) => {
                    if (v) setSortBy(v as SortKey);
                  }}
                >
                  <SelectTrigger>
                    {SORT_ITEMS.find((s) => s.value === sortBy)?.label}
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_ITEMS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {visibleIdeas.length === 0 ? (
              <div className="border-border/70 bg-card/40 text-muted-foreground flex items-center gap-3 rounded-2xl border border-dashed p-5 text-sm">
                <Lightbulb className="text-amber-600 size-5 shrink-0 dark:text-amber-400" />
                Tidak ada ide yang cocok dengan pencarian “{query}”.
              </div>
            ) : (
              <div className="grid gap-3">
                {visibleIdeas.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} disabled={pending} />
                ))}
              </div>
            )}
          </section>
        </>
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
      <div className="flex items-start gap-3.5">
        {/* Kotak skor tinted: ≥80 emerald, ≥50 amber, else rose */}
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums",
            typeof idea.score === "number"
              ? scoreToneClass(idea.score)
              : "bg-muted/70 text-muted-foreground",
          )}
          title="Skor ketajaman (self-critique)"
        >
          {typeof idea.score === "number" ? idea.score : "—"}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
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
              <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                Dipakai
              </span>
            ) : null}
          </div>
          <h3 className="text-foreground mt-1.5 font-bold tracking-tight">
            {idea.title}
          </h3>
        </div>
      </div>

      {idea.hook ? (
        <p className="text-foreground/90 mt-3 border-l-2 border-amber-500/50 pl-3 text-sm italic">
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
        <div className={cn(lab.nestedPanel, "mt-3 p-3")}>
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
            Berakar pada
          </p>
          <ul className="mt-1.5 space-y-1">
            {idea.citations.map((c, i) => (
              <li key={i} className="text-xs leading-relaxed">
                <span className="font-medium text-amber-700 dark:text-amber-300">
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
              ? "border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300"
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
