"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MessageSquare, RefreshCw } from "lucide-react";
import { SocialListeningPlatform } from "@prisma/client";
import { toast } from "sonner";
import { createSocialListeningMonitor } from "@/actions/research-social-listening";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SOCIAL_LISTENING_PLATFORM_LABELS } from "@/lib/research/labels";
import { lab } from "@/components/lab/lab-primitives";
import {
  DEFAULT_INSTAGRAM_SEARCH_LIMIT,
  DEFAULT_TIKTOK_SEARCH_LIMIT,
  MAX_INSTAGRAM_SEARCH_LIMIT,
  MAX_TIKTOK_SEARCH_LIMIT,
  parseSearchLimitInput,
} from "@/lib/research/social-listening/search-limits-public";
import { cn } from "@/lib/utils";

const ALL_PLATFORMS: SocialListeningPlatform[] = [
  SocialListeningPlatform.TIKTOK,
  SocialListeningPlatform.INSTAGRAM,
];

/** Form monitor baru (panel inline di halaman list). */
export function SocialMonitorForm({
  id,
  onCancel,
}: {
  id: string;
  /** Tidak diisi saat belum ada monitor (form jadi satu-satunya isi halaman). */
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [platforms, setPlatforms] = useState<SocialListeningPlatform[]>([
    SocialListeningPlatform.TIKTOK,
    SocialListeningPlatform.INSTAGRAM,
  ]);
  const [tiktokLimit, setTiktokLimit] = useState(String(DEFAULT_TIKTOK_SEARCH_LIMIT));
  const [instagramLimit, setInstagramLimit] = useState(
    String(DEFAULT_INSTAGRAM_SEARCH_LIMIT),
  );

  function togglePlatform(platform: SocialListeningPlatform) {
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
  }

  function handleCreate() {
    const keywords = keywordsText
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    if (!name.trim()) {
      toast.error("Isi nama monitor dulu, mis. \"Body care trending\".");
      return;
    }
    if (keywords.length === 0) {
      toast.error("Isi minimal satu keyword.");
      return;
    }
    if (platforms.length === 0) {
      toast.error("Pilih minimal satu platform.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createSocialListeningMonitor({
          name,
          keywords,
          platforms,
          tiktokSearchLimit: platforms.includes(SocialListeningPlatform.TIKTOK)
            ? parseSearchLimitInput(
                tiktokLimit,
                DEFAULT_TIKTOK_SEARCH_LIMIT,
                MAX_TIKTOK_SEARCH_LIMIT,
              )
            : DEFAULT_TIKTOK_SEARCH_LIMIT,
          instagramSearchLimit: platforms.includes(SocialListeningPlatform.INSTAGRAM)
            ? parseSearchLimitInput(
                instagramLimit,
                DEFAULT_INSTAGRAM_SEARCH_LIMIT,
                MAX_INSTAGRAM_SEARCH_LIMIT,
              )
            : DEFAULT_INSTAGRAM_SEARCH_LIMIT,
        });
        toast.success("Monitor dibuat. Jalankan sync untuk mulai mengumpulkan mention.");
        setName("");
        setKeywordsText("");
        router.push(`/research-hub/social-listening/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Monitor gagal dibuat. Periksa isian lalu coba lagi."));
      }
    });
  }

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        lab.panel,
        "grid gap-5",
        "animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none",
      )}
    >
      <div className="space-y-1">
        <h2 id={`${id}-title`} className="rh-section-title">
          Pantau percakapan dari keyword
        </h2>
        <p className="rh-lede">
          Mention dari TikTok dan Instagram dikumpulkan, lalu diklasifikasi AI
          menjadi pain point, wishlist, influencer, dan konten viral.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-name`}>Nama monitor</Label>
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mis. Body care trending"
            disabled={pending}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-keywords`}>Keyword</Label>
          <Input
            id={`${id}-keywords`}
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            placeholder="body lotion, sunscreen kulit gelap"
            aria-describedby={`${id}-keywords-hint`}
            disabled={pending}
          />
          <p id={`${id}-keywords-hint`} className="rh-meta">
            Pisahkan dengan koma.
          </p>
        </div>
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Platform</legend>
        <div className="flex flex-wrap gap-2">
          {ALL_PLATFORMS.map((p) => {
            const checked = platforms.includes(p);
            return (
              <label
                key={p}
                className={cn(
                  "border-border flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                  checked
                    ? "border-[color-mix(in_srgb,var(--lab-accent,var(--primary))_45%,var(--border))] bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_8%,transparent)]"
                    : "hover:bg-muted/60",
                )}
              >
                <Checkbox checked={checked} onCheckedChange={() => togglePlatform(p)} />
                {SOCIAL_LISTENING_PLATFORM_LABELS[p]}
              </label>
            );
          })}
        </div>
      </fieldset>
      {platforms.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {platforms.includes(SocialListeningPlatform.TIKTOK) ? (
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-tiktok-limit`}>Video TikTok per keyword</Label>
              <Input
                id={`${id}-tiktok-limit`}
                type="number"
                min={1}
                max={MAX_TIKTOK_SEARCH_LIMIT}
                value={tiktokLimit}
                onChange={(e) => setTiktokLimit(e.target.value)}
                aria-describedby={`${id}-tiktok-hint`}
                disabled={pending}
              />
              <p id={`${id}-tiktok-hint`} className="rh-meta">
                Maksimal {MAX_TIKTOK_SEARCH_LIMIT} video.
              </p>
            </div>
          ) : null}
          {platforms.includes(SocialListeningPlatform.INSTAGRAM) ? (
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-instagram-limit`}>Post Instagram per hashtag</Label>
              <Input
                id={`${id}-instagram-limit`}
                type="number"
                min={1}
                max={MAX_INSTAGRAM_SEARCH_LIMIT}
                value={instagramLimit}
                onChange={(e) => setInstagramLimit(e.target.value)}
                aria-describedby={`${id}-instagram-hint`}
                disabled={pending}
              />
              <p id={`${id}-instagram-hint`} className="rh-meta">
                Maksimal {MAX_INSTAGRAM_SEARCH_LIMIT} post.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Batal
          </Button>
        ) : null}
        <Button onClick={handleCreate} disabled={pending}>
          {pending ? (
            <RefreshCw className="animate-spin" aria-hidden />
          ) : (
            <MessageSquare aria-hidden />
          )}
          {pending ? "Membuat…" : "Buat monitor"}
        </Button>
      </div>
    </section>
  );
}
