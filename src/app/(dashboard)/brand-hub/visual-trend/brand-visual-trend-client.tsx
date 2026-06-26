"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Copy, ImageIcon, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { generateVisualTrendBriefAction } from "@/actions/brand-visual-trend";
import { actionErrorMessage } from "@/lib/action-error-message";
import { useBrandHubBrandId, brandHubHref } from "@/hooks/use-brand-hub-brand-id";
import type { VisualTrendCollectionAnalytics } from "@/lib/brand-research/visual-trend-analytics";
import { BrandHubEmptyState, BrandHubSection, hub } from "@/components/brand-hub/brand-hub-primitives";
import { Badge } from "@/components/ui/badge";
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
      className="border-primary/30 bg-primary/5 mt-3 rounded-xl border p-4"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          Brief estetika
          <span className="text-muted-foreground ml-2 text-xs font-normal">
            — {entry.label}
          </span>
        </p>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onCopy}>
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
      <BrandHubEmptyState
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

  return (
    <div className={cn("grid gap-6 lg:grid-cols-[1fr_minmax(240px,300px)]", hub.entrance)}>
      <div className="flex flex-col gap-4">
        <BrandHubSection
          title="Koleksi Pinterest"
          description={`${collections.length} koleksi — brief estetika dirangkum AI dari tag & palet warna pin (bukan analisis gambar).`}
          action={
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
          }
        >
          {generatingAll ? (
            <div className={cn(hub.nestedPanel, "text-muted-foreground flex items-center gap-2 text-sm")}>
              <Loader2 className="size-4 animate-spin" />
              AI merangkum brief dari tag &amp; palet (bukan analisis gambar)…
            </div>
          ) : null}

          {allBrief ? (
            <div className={cn(hub.panel, "border-primary/25")}>
              <BriefOutputPanel
                entry={allBrief}
                innerRef={(el) => {
                  briefRefs.current[ALL_BRIEF_KEY] = el;
                }}
                onCopy={() => copyBrief(ALL_BRIEF_KEY)}
              />
            </div>
          ) : null}
        </BrandHubSection>

        {collections.map((c, index) => {
          const key = c.id;
          const entry = briefByKey[key];
          const generating = pending && activeBriefKey === key;

          return (
            <div
              key={c.id}
              className={cn(hub.panel, hub.entrance, "space-y-4")}
              style={
                index > 0 && index < 8
                  ? { animationDelay: `${index * 50}ms` }
                  : undefined
              }
            >
              <div className="flex flex-row items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">{c.name}</h3>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {c.keywords.join(", ") || "Tanpa keyword"}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 tabular-nums">
                  {c.assetCount} asset
                </Badge>
              </div>
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="text-muted-foreground">
                    Scrape terakhir:{" "}
                    {c.lastAssetAt
                      ? new Date(c.lastAssetAt).toLocaleDateString("id-ID")
                      : "—"}
                  </span>
                </div>

                {c.palette ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground text-xs">Palet dominan:</span>
                    {[
                      c.palette.primary,
                      c.palette.secondary,
                      c.palette.accent,
                      ...c.palette.neutrals,
                    ].map((hex) => (
                      <span
                        key={hex}
                        className="size-6 rounded-md border shadow-sm"
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

                {c.topTags.length > 0 ? (
                  <div>
                    <p className="text-muted-foreground mb-2 text-xs font-medium">
                      Tag teratas
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.topTags.map((t) => (
                        <Badge key={t.tag} variant="outline" className="text-[10px]">
                          {t.tag}{" "}
                          <span className="text-muted-foreground ml-1 tabular-nums">
                            {t.count}
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

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
                    AI merangkum dari tag &amp; palet, bukan analisis gambar (±30 detik)…
                  </p>
                ) : null}

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
          );
        })}
      </div>

      <aside className="flex flex-col gap-4">
        <BrandHubSection title="Konteks pasar (Research)" delayMs={0}>
          <div className={hub.panel}>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Sinyal kategori dari Trend Radar Research Hub — untuk strategi, bukan
              estetika visual.
            </p>
            {marketNarrative ? (
              <p className="mt-3 text-xs leading-relaxed">{marketNarrative}</p>
            ) : null}
            {marketContext.length === 0 ? (
              <p className="text-muted-foreground mt-3 text-xs">Belum ada digest tren siap.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {marketContext.map((item) => (
                  <li key={item.id} className={cn(hub.nestedPanel, "text-xs")}>
                    <p className="font-medium">{item.title}</p>
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
              className="mt-4 w-full"
              nativeButton={false}
              render={
                <Link href={brandHubHref("/brand-hub/strategy", brandId)}>
                  Pilih sumber di Strategy
                </Link>
              }
            />
          </div>
        </BrandHubSection>

        <BrandHubSection title="Visual Library" delayMs={50}>
          <div className={hub.panel}>
            <p className="text-muted-foreground mb-3 text-xs">
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
        </BrandHubSection>
      </aside>
    </div>
  );
}
