"use client";

import { useState } from "react";
import {
  Globe,
  Hash,
  KeyRound,
  MessageSquareText,
  Newspaper,
  Radio,
  Search,
  ShieldCheck,
  Target,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { ModuleSourceBox } from "@/components/research-hub/usp-context-source-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  hashtagsToInput,
  labelFromRssUrl,
  parseHashtagInput,
  type TrendSourceConfig,
} from "@/lib/research/trend-radar/trend-source-config-types";

type SourceKey = keyof TrendSourceConfig["enabled"];

const SOURCE_META: Record<
  SourceKey,
  { label: string; hint: string; icon: LucideIcon }
> = {
  googleTrends: {
    label: "Google Trends",
    hint: "Rising & top queries dari seed keyword",
    icon: Search,
  },
  rss: {
    label: "RSS Feed",
    hint: "Berita industri & tren global",
    icon: Newspaper,
  },
  tiktok: {
    label: "TikTok",
    hint: "Hashtag trending — wajib isi manual",
    icon: Hash,
  },
  bpom: {
    label: "BPOM Kosmetika",
    hint: "Delta registrasi produk dari cekbpom.pom.go.id",
    icon: ShieldCheck,
  },
  reviewIntel: {
    label: "Review Intelligence",
    hint: "Tema keluhan & pujian dari review kompetitor",
    icon: MessageSquareText,
  },
  competitor: {
    label: "Competitor Tracker",
    hint: "Velocity review count & SKU baru",
    icon: Target,
  },
  keywordIntel: {
    label: "Keyword Intel",
    hint: "Volume & trend keyword dari DataForSEO",
    icon: KeyRound,
  },
  socialListening: {
    label: "Social Listening",
    hint: "Pain points & wishlist dari TikTok/Instagram",
    icon: Radio,
  },
};

type Props = {
  config: TrendSourceConfig;
  onChange: (next: TrendSourceConfig) => void;
  tiktokConfigured?: boolean;
};

export function TrendSourceConfigPicker({
  config,
  onChange,
  tiktokConfigured = true,
}: Props) {
  const [newFeedUrl, setNewFeedUrl] = useState("");
  const [hashtagInput, setHashtagInput] = useState(
    hashtagsToInput(config.tiktokHashtags),
  );

  function toggleSource(key: SourceKey) {
    onChange({
      ...config,
      enabled: { ...config.enabled, [key]: !config.enabled[key] },
    });
  }

  function toggleFeed(url: string) {
    onChange({
      ...config,
      rssFeeds: config.rssFeeds.map((f) =>
        f.url === url ? { ...f, enabled: !f.enabled } : f,
      ),
    });
  }

  function removeFeed(url: string) {
    onChange({
      ...config,
      rssFeeds: config.rssFeeds.filter((f) => f.url !== url),
    });
  }

  function addFeed() {
    const url = newFeedUrl.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      return;
    }
    if (config.rssFeeds.some((f) => f.url === url)) {
      setNewFeedUrl("");
      return;
    }
    if (config.rssFeeds.length >= 20) return;
    onChange({
      ...config,
      rssFeeds: [
        ...config.rssFeeds,
        { url, label: labelFromRssUrl(url), enabled: true },
      ],
    });
    setNewFeedUrl("");
  }

  function updateHashtags(raw: string) {
    setHashtagInput(raw);
    onChange({
      ...config,
      tiktokHashtags: parseHashtagInput(raw),
    });
  }

  const rssCount = config.rssFeeds.filter((f) => f.enabled).length;

  return (
    <div className="space-y-3">
      {(Object.keys(SOURCE_META) as SourceKey[]).map((key) => {
        const meta = SOURCE_META[key];
        const Icon = meta.icon;
        const hasData =
          key === "tiktok"
            ? tiktokConfigured
            : key === "reviewIntel" ||
                key === "competitor" ||
                key === "keywordIntel" ||
                key === "socialListening"
              ? true
              : true;
        const enabled = config.enabled[key];
        const isOpen = enabled && hasData;

        return (
          <ModuleSourceBox
            key={key}
            config={{ label: meta.label, short: meta.label, hint: meta.hint, icon: Icon }}
            icon={Icon}
            enabled={enabled}
            hasData={hasData}
            isOpen={isOpen}
            selectionCount={
              key === "rss" && enabled
                ? rssCount
                : key === "tiktok" && enabled
                  ? config.tiktokHashtags.length
                  : null
            }
            onToggle={() => toggleSource(key)}
          >
            {key === "rss" ? (
              <div className="space-y-2">
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {config.rssFeeds.map((feed) => (
                    <label
                      key={feed.url}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-xs",
                        feed.enabled
                          ? "border-primary/30 bg-primary/5"
                          : "border-border/60",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={feed.enabled}
                        onChange={() => toggleFeed(feed.url)}
                        className="size-3.5 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{feed.label ?? labelFromRssUrl(feed.url)}</span>
                        <span className="text-muted-foreground block truncate text-[10px]">
                          {feed.url}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0"
                        onClick={(e) => {
                          e.preventDefault();
                          removeFeed(feed.url);
                        }}
                        title="Hapus feed"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com/feed.xml"
                    value={newFeedUrl}
                    onChange={(e) => setNewFeedUrl(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addFeed}
                    disabled={!newFeedUrl.trim()}
                  >
                    Tambah
                  </Button>
                </div>
              </div>
            ) : null}

            {key === "tiktok" ? (
              <div className="space-y-1.5">
                <Label htmlFor="tiktok-hashtags" className="text-xs">
                  Hashtag (pisahkan koma)
                </Label>
                <Input
                  id="tiktok-hashtags"
                  placeholder="skincare, beautyindonesia, bodycare"
                  value={hashtagInput}
                  onChange={(e) => updateHashtags(e.target.value)}
                  className="text-sm"
                />
                <p className="text-muted-foreground text-[11px]">
                  Default hashtag beauty Indonesia — bisa disesuaikan.
                </p>
              </div>
            ) : null}

            {key === "googleTrends" ? (
              <p className="text-muted-foreground text-xs">
                Menggunakan seed keyword dari watchlist atau default global.
              </p>
            ) : null}

            {key === "bpom" ? (
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Globe className="size-3 shrink-0" aria-hidden />
                Data produk kosmetika terdaftar dari portal resmi BPOM.
              </p>
            ) : null}
          </ModuleSourceBox>
        );
      })}
    </div>
  );
}

export function validateTrendConfigClient(config: TrendSourceConfig): string | null {
  if (!Object.values(config.enabled).some(Boolean)) {
    return "Aktifkan minimal satu sumber.";
  }
  if (config.enabled.rss && !config.rssFeeds.some((f) => f.enabled)) {
    return "RSS aktif — pilih minimal satu feed.";
  }
  if (config.enabled.tiktok && config.tiktokHashtags.length === 0) {
    return "TikTok aktif — isi minimal satu hashtag.";
  }
  return null;
}
