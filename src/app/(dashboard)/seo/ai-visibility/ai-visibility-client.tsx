"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import {
  Bot,
  Check,
  ExternalLink,
  Loader2,
  Play,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import {
  ResearchHubEmptyState,
  ResearchHubStatChip,
  hub,
} from "@/components/research-hub/research-hub-primitives";
import { isSeoStatusBusy } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createAiVisibilityRun,
  deleteAiVisibilityRun,
} from "@/actions/seo-ai-visibility";
import type {
  AiVisibilityResult,
  AiVisibilitySummary,
} from "@/lib/seo/ai-visibility/rules";
import { cn } from "@/lib/utils";

export type AiVisibilityRunRow = {
  id: string;
  name: string;
  brandTerms: string[];
  keywords: string[];
  platforms: string[];
  status: SeoAnalysisStatus;
  results: AiVisibilityResult[];
  summary: AiVisibilitySummary | null;
  dataNotice: string | null;
  errorMessage: string | null;
  createdAt: string;
};

const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
};

export function AiVisibilityClient({ items }: { items: AiVisibilityRunRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [brandTerms, setBrandTerms] = useState("");
  const [keywords, setKeywords] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["chatgpt", "perplexity"]);
  const [openRunId, setOpenRunId] = useState<string | null>(items[0]?.id ?? null);

  const hasBusy = items.some((i) => isSeoStatusBusy(i.status));
  useEffect(() => {
    if (!hasBusy) return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [hasBusy, router]);

  function togglePlatform(p: string) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  function handleCreate() {
    const brands = brandTerms.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    const kws = keywords.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    if (brands.length === 0 || kws.length === 0 || platforms.length === 0) {
      toast.error("Isi brand terms, keyword, dan minimal satu platform.");
      return;
    }
    startTransition(async () => {
      try {
        const { id } = await createAiVisibilityRun({
          name: name.trim() || `Cek AI ${new Date().toLocaleDateString("id-ID")}`,
          brandTerms: brands.slice(0, 10),
          keywords: kws.slice(0, 20),
          platforms: platforms as ("chatgpt" | "gemini" | "perplexity")[],
        });
        setName("");
        setOpenRunId(id);
        toast.success("Cek AI visibility dimulai — bisa memakan 1–3 menit.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memulai cek."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteAiVisibilityRun(id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  const openRun = items.find((i) => i.id === openRunId) ?? items[0] ?? null;

  return (
    <div className="flex flex-col gap-5">
      {/* Form */}
      <div className={cn(hub.panel, "grid gap-3")}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label>Nama run (opsional)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cek bulanan Juli"
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Brand terms (nama, domain — pisah koma)</Label>
            <Input
              value={brandTerms}
              onChange={(e) => setBrandTerms(e.target.value)}
              placeholder="Glowify, glowify.com"
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Platform</Label>
            <div className="flex items-center gap-1.5">
              {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                <Button
                  key={key}
                  type="button"
                  variant={platforms.includes(key) ? "default" : "outline"}
                  size="sm"
                  onClick={() => togglePlatform(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Keyword komersial (maks 20, pisah koma/baris)</Label>
          <Textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder={"serum niacinamide\nsunscreen untuk kulit berminyak"}
            rows={3}
            disabled={pending}
          />
        </div>
        <div>
          <Button onClick={handleCreate} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Play />}
            Jalankan cek
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <ResearchHubEmptyState
          icon={Bot}
          title="Belum ada cek AI visibility"
          description="Masukkan brand & keyword komersial Anda — kami tanyakan ke AI seperti pengguna nyata, lalu cek apakah brand Anda muncul di jawabannya."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          {/* Daftar run */}
          <div className="flex h-fit flex-col gap-2">
            {items.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => setOpenRunId(run.id)}
                className={cn(
                  hub.card,
                  "flex items-center gap-2 p-3 text-left",
                  run.id === openRun?.id && "border-primary/50",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {run.name}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {run.summary
                      ? `${run.summary.mentionRate}% mention · ${run.summary.totalChecks} cek`
                      : `${run.keywords.length} keyword`}
                  </span>
                </span>
                <SeoStatusBadge status={run.status} />
              </button>
            ))}
          </div>

          {/* Detail run */}
          {openRun ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-3">
                  {openRun.summary ? (
                    <>
                      <ResearchHubStatChip
                        label="Mention rate"
                        value={`${openRun.summary.mentionRate}%`}
                        tone="primary"
                      />
                      {Object.entries(openRun.summary.byPlatform).map(([p, s]) => (
                        <ResearchHubStatChip
                          key={p}
                          label={PLATFORM_LABELS[p] ?? p}
                          value={`${s.rate}%`}
                        />
                      ))}
                    </>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(openRun.id)}
                  disabled={pending}
                  aria-label="Hapus run"
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>

              {openRun.errorMessage ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {openRun.errorMessage}
                </div>
              ) : null}
              {openRun.dataNotice ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400">
                  {openRun.dataNotice}
                </div>
              ) : null}

              {isSeoStatusBusy(openRun.status) ? (
                <div className={cn(hub.card, "flex items-center gap-3 p-6")}>
                  <Loader2 className="text-primary size-5 animate-spin" />
                  <p className="text-muted-foreground text-sm">
                    Menanyakan {openRun.keywords.length} keyword ke{" "}
                    {openRun.platforms
                      .map((p) => PLATFORM_LABELS[p] ?? p)
                      .join(", ")}
                    … ({openRun.results.length} cek selesai)
                  </p>
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                {openRun.results.map((r, i) => (
                  <div key={i} className={cn(hub.card, "p-3")}>
                    <div className="flex flex-wrap items-center gap-2">
                      {r.error ? (
                        <Badge variant="outline">gagal</Badge>
                      ) : r.mentioned ? (
                        <Check className="size-4 shrink-0 text-emerald-500" />
                      ) : (
                        <X className="size-4 shrink-0 text-red-500" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {r.keyword}
                      </span>
                      <Badge variant="secondary">
                        {PLATFORM_LABELS[r.platform] ?? r.platform}
                      </Badge>
                      {r.matchedTerms.length > 0 ? (
                        <Badge variant="outline">
                          {r.matchedTerms.join(", ")}
                        </Badge>
                      ) : null}
                    </div>
                    {r.error ? (
                      <p className="text-destructive mt-1 text-xs">{r.error}</p>
                    ) : r.excerpt ? (
                      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                        “{r.excerpt}”
                      </p>
                    ) : null}
                    {r.citations.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        {r.citations.slice(0, 4).map((c) => (
                          <a
                            key={c}
                            href={c}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground inline-flex max-w-60 items-center gap-1 truncate text-[11px] hover:underline"
                          >
                            <ExternalLink className="size-3 shrink-0" />
                            <span className="truncate">
                              {c.replace(/^https?:\/\//, "")}
                            </span>
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
