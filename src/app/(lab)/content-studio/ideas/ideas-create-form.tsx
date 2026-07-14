"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { createContentIdeaSet } from "@/actions/content-studio-ideas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const PLATFORMS = ["Instagram", "TikTok", "TikTok Shop", "Shopee"] as const;
type Platform = (typeof PLATFORMS)[number];

export function IdeasCreateForm({ brandId }: { brandId: string | null }) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>([
    "Instagram",
    "TikTok",
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function togglePlatform(p: Platform) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (topic.trim().length < 3) {
      setError("Topik minimal 3 karakter.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await createContentIdeaSet({
          topic: topic.trim(),
          goal: goal.trim() || null,
          ownerBrandId: brandId,
          platforms,
        });
        const qs = brandId ? `?brandId=${encodeURIComponent(brandId)}` : "";
        router.push(`/content-studio/ideas/${res.id}${qs}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal membuat ide.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cs-topic">Topik / kampanye</Label>
          <Input
            id="cs-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="mis. Serum vitamin C untuk kulit kusam"
            maxLength={200}
            disabled={pending}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cs-goal">
            Tujuan{" "}
            <span className="text-muted-foreground text-xs">(opsional)</span>
          </Label>
          <Input
            id="cs-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="mis. awareness produk baru, edukasi, hard-sell"
            maxLength={300}
            disabled={pending}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Platform</Label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const active = platforms.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePlatform(p)}
                disabled={pending}
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/30",
                )}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      {!brandId ? (
        <p className="text-muted-foreground text-xs leading-relaxed">
          Tip: pilih <span className="font-medium">Brand scope</span> di sidebar
          agar ide digrounding ke data brand (review, iklan kompetitor, tren).
          Tanpa brand, ide hanya berbasis topik.
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {pending ? "Membuat…" : "Generate ide"}
        </Button>
      </div>
    </form>
  );
}
