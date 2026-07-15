"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import {
  Copy,
  ImageIcon,
  Loader2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { generateVisualTrendBriefAction } from "@/actions/brand-visual-trend";
import { actionErrorMessage } from "@/lib/action-error-message";
import { useBrandHubBrandId, brandHubHref } from "@/hooks/use-brand-hub-brand-id";
import type { VisualTrendCollectionAnalytics } from "@/lib/brand-research/visual-trend-analytics";
import { LabEmptyState, lab } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MarketItem = {
  id: string;
  title: string;
  score: number;
  phase: string | null;
  source: string | null;
};

type BriefEntry = { text: string; label: string };

const ALL_BRIEF_KEY = "__all__";

function BriefOutputPanel({
  entry,
  innerRef,
  onCopy,
}: {
  entry: BriefEntry;
  innerRef?: (el: HTMLDivElement | null) => void;
  onCopy: () => void;
}) {
  return (
    <div
      ref={innerRef}
      className="rounded-xl border border-pink-500/25 bg-pink-500/5 p-4"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold tracking-tight">
          Brief estetika
          <span className="text-muted-foreground ml-2 text-xs font-normal">
            — {entry.label}
          </span>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onCopy}
        >
          <Copy className="mr-1 size-3" />
          Salin
        </Button>
      </div>
      <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
        {entry.text}
      </p>
    </div>
  );
}

export function BrandVisualTrendClient({
  collections,
  marketContext,
  marketNarrative,
}: {
  collections: VisualTrendCollectionAnalytics[];
  marketContext: MarketItem[];
  marketNarrative: string | null;
}) {
  const brandId = useBrandHubBrandId();
  const [pending, startTransition] = useTransition();
  const [activeBriefKey, setActiveBriefKey] = useState<string | null>(null);
  const [briefByKey, setBriefByKey] = useState<Record<string, BriefEntry>>({});
  const briefRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function scrollToBrief(key: string) {
    requestAnimationFrame(() => {
      briefRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function runBrief(collectionId: string | null, label: string) {
    const key = collectionId ?? ALL_BRIEF_KEY;
    setActiveBriefKey(key);
    startTransition(async () => {
      try {
        const result = await generateVisualTrendBriefAction(collectionId, brandId);
        setBriefByKey((prev) => ({
          ...prev,
          [key]: { text: result.brief, label },
        }));
        toast.success("Brief estetika muncul di bawah tombol generate.");
        scrollToBrief(key);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal generate brief."));
      } finally {
        setActiveBriefKey(null);
      }
    });
  }

  function copyBrief(key: string) {
    const text = briefByKey[key]?.text;
    if (!text) return;
    void navigator.clipboard.writeText(text).then(() => {
      toast.success("Brief disalin ke clipboard.");
    });
  }

  if (collections.length === 0) {
    return (
      <LabEmptyState
        icon={TrendingUp}
        title="Belum ada koleksi Pinterest"
        description="Scrape atau upload referensi visual di Visual Library untuk memulai analisis tren estetika."
        action={
          <Button
            nativeButton={false}
            render={
              <Link href={brandHubHref("/brand-hub/visual-library", brandId)}>
                Buka Visual Library
              </Link>
            }
          />
        }
      />
    );
  }

  const allBrief = briefByKey[ALL_BRIEF_KEY];
  const generatingAll = pending && activeBriefKey === ALL_BRIEF_KEY;

  // Agregat murah dari koleksi yang sudah di-fetch (tanpa query baru).
  const totalPins = collections.reduce((n, c) => n + c.assetCount, 0);
  const uniqueTagCount = new Set(
    collections.flatMap((c) => c.topTags.map((t) => t.tag)),
  ).size;
  const paletteReadyCount = collections.filter((c) => c.palette != null).length;

  return (
    <div className={cn("flex flex-col gap-5", lab.entrance)}>
      {/* Papan bento ringkasan estetika */}
      <div className="grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 md:grid-cols-4">
        <div className="bento-tile border-transparent bg-pink-600 shadow-md shadow-pink-600/20 dark:bg-pink-500">
          <span className="text-[11.5px] font-semibold text-pink-100 dark:text-pink-950/70">
            Pin dianalisis
          </span>
          <span className="bento-value text-white dark:text-pink-950">
            {totalPins}
          </span>
          <span className="text-[11px] font-medium text-pink-100/90 dark:text-pink-900/80">
            dari {collections.length} koleksi Pinterest
          </span>
        </div>

        <div className="bento-tile border-transparent bg-[#fde7f1] dark:bg-pink-400/10">
          <span className="text-[11.5px] font-semibold text-pink-800/70 dark:text-pink-200/60">
            Koleksi
          </span>
          <span className="bento-value text-pink-900 dark:text-pink-300">
            {collections.length}
          </span>
          <span className="text-[11px] font-medium text-pink-800/60 dark:text-pink-200/50">
            sumber tren estetika
          </span>
        </div>

        <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
          <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
            Tag unik
          </span>
          <span className="bento-value text-amber-900 dark:text-amber-300">
            {uniqueTagCount}
          </span>
          <span className="text-[11px] font-medium text-amber-800/60 dark:text-amber-200/50">
            sinyal estetika teratas
          </span>
        </div>

        <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
          <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
            Palet terdeteksi
          </span>
          <span className="bento-value text-violet-950 dark:text-violet-300">
            {paletteReadyCount}
            <span className="text-lg font-bold text-violet-700/50 dark:text-violet-300/50">
              /{collections.length}
            </span>
          </span>
          <span className="text-[11px] font-medium text-violet-700/60 dark:text-violet-300/50">
            koleksi dengan warna dominan
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(240px,300px)] lg:items-start">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className={lab.sectionTitle}>Koleksi Pinterest</h2>
              <p className={lab.sectionDesc}>
                Brief estetika dirangkum AI dari tag & palet warna pin (bukan
                analisis gambar).
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => runBrief(null, "Semua koleksi")}
            >
              {generatingAll ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 size-3.5" />
              )}
              {generatingAll ? "Menghasilkan…" : "Generate brief (semua)"}
            </Button>
          </div>

          {generatingAll ? (
            <div className="border-border/60 bg-muted/30 text-muted-foreground flex items-center gap-2 rounded-xl border p-4 text-sm">
              <Loader2 className="size-4 animate-spin" />
              AI merangkum brief dari tag &amp; palet (bukan analisis gambar)…
            </div>
          ) : null}

          {allBrief ? (
            <BriefOutputPanel
              entry={allBrief}
              innerRef={(el) => {
                briefRefs.current[ALL_BRIEF_KEY] = el;
              }}
              onCopy={() => copyBrief(ALL_BRIEF_KEY)}
            />
          ) : null}

          {collections.map((c, index) => {
            const key = c.id;
            const entry = briefByKey[key];
            const generating = pending && activeBriefKey === key;

            return (
              <div
                key={c.id}
                className={cn("bento-tile justify-start gap-4", lab.entrance)}
                style={
                  index > 0 && index < 8
                    ? { animationDelay: `${index * 50}ms` }
                    : undefined
                }
              >
                {/* Header koleksi */}
                <div className="flex flex-row items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/15 text-base font-extrabold uppercase text-pink-700 dark:text-pink-300"
                      aria-hidden
                    >
                      {c.name.trim().charAt(0) || "?"}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-foreground truncate text-base font-bold tracking-tight">
                        {c.name}
                      </h3>
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        {c.keywords.join(", ") || "Tanpa keyword"}
                      </p>
                    </div>
                  </div>
                  <span className="bg-muted/60 text-foreground inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums">
                    {c.assetCount} asset
                  </span>
                </div>

                {/* Mini-stats */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                      Scrape terakhir
                    </p>
                    <p className="text-foreground mt-0.5 truncate text-sm font-extrabold tabular-nums tracking-tight">
                      {c.lastAssetAt
                        ? new Date(c.lastAssetAt).toLocaleDateString("id-ID")
                        : "—"}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                      Tag teratas
                    </p>
                    <p className="text-foreground mt-0.5 truncate text-sm font-extrabold tabular-nums tracking-tight">
                      {c.topTags.length}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                      Palet
                    </p>
                    <p className="text-foreground mt-0.5 truncate text-sm font-extrabold tracking-tight">
                      {c.palette ? "Terdeteksi" : "—"}
                    </p>
                  </div>
                </div>

                {/* Palet dominan */}
                {c.palette ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground text-xs font-medium">
                      Palet dominan
                    </span>
                    {[
                      c.palette.primary,
                      c.palette.secondary,
                      c.palette.accent,
                      ...c.palette.neutrals,
                    ].map((hex) => (
                      <span
                        key={hex}
                        className="size-7 rounded-lg border border-border/70 shadow-sm"
                        style={{ backgroundColor: hex }}
                        title={hex}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Palet belum terdeteksi — pastikan asset memiliki dominantColors.
                  </p>
                )}

                {/* Tag pills */}
                {c.topTags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {c.topTags.map((t) => (
                      <span
                        key={t.tag}
                        className="inline-flex items-center gap-1 rounded-full bg-pink-500/10 px-2.5 py-1 text-[10px] font-semibold text-pink-800 dark:text-pink-300"
                      >
                        {t.tag}
                        <span className="text-pink-800/60 tabular-nums dark:text-pink-300/60">
                          {t.count}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* Footer actions */}
                <div className="border-border/60 flex flex-col gap-3 border-t pt-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      size="sm"
                      variant={entry ? "secondary" : "outline"}
                      disabled={pending || c.assetCount === 0}
                      onClick={() => runBrief(c.id, c.name)}
                    >
                      {generating ? (
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1.5 size-3.5" />
                      )}
                      {generating
                        ? "Menghasilkan brief…"
                        : entry
                          ? "Generate ulang brief"
                          : "Generate brief koleksi"}
                    </Button>
                    {generating ? (
                      <p className="text-muted-foreground text-xs">
                        AI merangkum dari tag &amp; palet, bukan analisis gambar
                        (±30 detik)…
                      </p>
                    ) : null}
                  </div>

                  {entry ? (
                    <BriefOutputPanel
                      entry={entry}
                      innerRef={(el) => {
                        briefRefs.current[key] = el;
                      }}
                      onCopy={() => copyBrief(key)}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rail konteks — sticky di desktop */}
        <aside className="flex flex-col gap-3 lg:sticky lg:top-20">
          <div className="bento-tile justify-start gap-3">
            <span className="bento-label">Konteks pasar (Research)</span>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Sinyal kategori dari Trend Radar Research Hub — untuk strategi,
              bukan estetika visual.
            </p>
            {marketNarrative ? (
              <p className="text-xs leading-relaxed">{marketNarrative}</p>
            ) : null}
            {marketContext.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                Belum ada digest tren siap.
              </p>
            ) : (
              <ul className="space-y-2">
                {marketContext.map((item) => (
                  <li
                    key={item.id}
                    className="border-border/60 bg-muted/30 rounded-xl border p-3 text-xs"
                  >
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-muted-foreground mt-1">
                      Skor {item.score.toFixed(1)}
                      {item.phase ? ` · ${item.phase}` : ""}
                      {item.source ? ` · ${item.source}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              nativeButton={false}
              render={
                <Link href={brandHubHref("/brand-hub/strategy", brandId)}>
                  Pilih sumber di Strategy
                </Link>
              }
            />
          </div>

          <div className="bento-tile justify-start gap-3 border-transparent bg-[#fde7f1] dark:bg-pink-400/10">
            <span className="text-[11.5px] font-semibold text-pink-800/70 dark:text-pink-200/60">
              Visual Library
            </span>
            <p className="text-xs leading-relaxed text-pink-950/80 dark:text-pink-100/80">
              Tambah koleksi Pinterest untuk memperkaya analisis tren visual.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              nativeButton={false}
              render={
                <Link href={brandHubHref("/brand-hub/visual-library", brandId)}>
                  <ImageIcon className="mr-1.5 size-3.5" />
                  Kelola visual
                </Link>
              }
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
