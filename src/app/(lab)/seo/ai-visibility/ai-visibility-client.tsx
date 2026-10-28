"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import {
  Bot,
  Check,
  ExternalLink,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AI_ENGINES,
  AiEngineChip,
  AiEngineLogo,
  aiEngineLabel,
  isAiEngine,
} from "@/components/seo/ai-engine-logo";
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import { LabEmptyState, lab } from "@/components/lab/lab-primitives";
import { isSeoRunStale, isSeoStatusBusy } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createAiVisibilityRun,
  deleteAiVisibilityRun,
  rerunAiVisibilityRun,
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
  updatedAt: string;
};

const PLATFORM_KEYS = Object.keys(AI_ENGINES) as (keyof typeof AI_ENGINES)[];

/** Ringkasan lama (sebelum ada `failedChecks`) dibaca sebagai 0 gagal. */
function failedOf(summary: AiVisibilitySummary | null | undefined): number {
  return summary?.failedChecks ?? 0;
}

/**
 * Teks mention rate yang jujur: "—" bila tidak ada cek berhasil sama sekali
 * tetapi ada yang gagal (0% / 100% dari nol sampel menyesatkan).
 */
function formatRate(valid: number, failed: number, rate: number): string {
  if (valid === 0 && failed > 0) return "—";
  return `${rate}%`;
}

/** Chip kecil "N gagal" bernada error (null bila 0). */
function FailedChip({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10.5px] font-bold leading-none text-rose-700 tabular-nums dark:text-rose-300",
        className,
      )}
    >
      {count} gagal
    </span>
  );
}

export function AiVisibilityClient({
  items,
  totalRuns,
}: {
  items: AiVisibilityRunRow[];
  /** Total run di DB (daftar dibatasi `take`, jadi bukan `items.length`). */
  totalRuns: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [brandTerms, setBrandTerms] = useState("");
  const [keywords, setKeywords] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["chatgpt", "perplexity"]);
  const [openRunId, setOpenRunId] = useState<string | null>(items[0]?.id ?? null);
  const [formOpen, setFormOpen] = useState(items.length === 0);

  /* Agregat portofolio dari run yang sudah punya ringkasan. */
  const portfolio = useMemo(() => {
    const ready = items.filter((i) => i.summary != null);
    const totalChecks = ready.reduce(
      (acc, i) => acc + (i.summary?.totalChecks ?? 0),
      0,
    );
    const mentioned = ready.reduce(
      (acc, i) => acc + (i.summary?.mentionedChecks ?? 0),
      0,
    );
    const failed = ready.reduce((acc, i) => acc + failedOf(i.summary), 0);
    return {
      readyRuns: ready.length,
      totalChecks,
      mentioned,
      failed,
      rate:
        totalChecks > 0 ? Math.round((mentioned / totalChecks) * 100) : null,
      running: items.filter((i) => isSeoStatusBusy(i.status)).length,
    };
  }, [items]);

  const hasBusy = items.some((i) => isSeoStatusBusy(i.status));
  useEffect(() => {
    if (!hasBusy) return;
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 5000);
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
          platforms: platforms as (
            | "chatgpt"
            | "gemini"
            | "claude"
            | "perplexity"
          )[],
        });
        setName("");
        setOpenRunId(id);
        setFormOpen(false);
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

  function handleRerun(id: string) {
    startTransition(async () => {
      try {
        await rerunAiVisibilityRun(id);
        toast.success("Run dijalankan ulang — tiap cek menanyakan ulang ke AI.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menjalankan ulang."));
      }
    });
  }

  const openRun = items.find((i) => i.id === openRunId) ?? items[0] ?? null;
  const openRunBusy = openRun ? isSeoStatusBusy(openRun.status) : false;
  const openRunStale = openRun
    ? isSeoRunStale(openRun.status, openRun.updatedAt)
    : false;
  const canRerun = !!openRun && (!openRunBusy || openRunStale);

  return (
    <div className="flex flex-col gap-5">
      {/* Ringkasan portofolio */}
      {portfolio.readyRuns > 0 ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          <div className="bento-tile border-transparent bg-teal-600 shadow-md shadow-teal-600/20 dark:bg-teal-500">
            <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
              Mention rate
            </span>
            <span className="bento-value flex items-baseline gap-2 text-white dark:text-teal-950">
              {portfolio.rate != null ? (
                <>
                  {portfolio.rate}
                  <span className="text-lg font-bold text-teal-200/80 dark:text-teal-900/60">
                    %
                  </span>
                </>
              ) : (
                "—"
              )}
              <FailedChip
                count={portfolio.failed}
                className="bg-white/90 text-rose-700 dark:bg-teal-950/80 dark:text-rose-300"
              />
            </span>
            <span className="text-[11px] font-medium text-teal-100/90 dark:text-teal-900/80">
              gabungan {portfolio.readyRuns} run selesai
              {portfolio.failed > 0 ? " · cek gagal tidak dihitung" : ""}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Brand disebut</span>
            <span className="bento-value">
              {portfolio.mentioned}
              <span className="text-muted-foreground/60 text-lg font-bold">
                {" "}
                / {portfolio.totalChecks}
              </span>
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              jawaban AI menyebut brand Anda
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Total run</span>
            <span className="bento-value">{totalRuns}</span>
            <span className="text-muted-foreground text-[11px] font-medium">
              {totalRuns > items.length
                ? `${items.length} terbaru ditampilkan`
                : "riwayat cek AI visibility"}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Cek berjalan</span>
            <span
              className={cn(
                "bento-value",
                portfolio.running > 0 && "text-amber-600 dark:text-amber-400",
              )}
            >
              {portfolio.running}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              {portfolio.running > 0
                ? "hasil ter-update otomatis"
                : "tidak ada proses aktif"}
            </span>
          </div>
        </div>
      ) : null}

      {/* Header + toggle form */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={lab.sectionTitle}>Riwayat cek</h2>
          <p className={lab.sectionDesc}>
            {items.length === 0
              ? "Mulai dengan cek pertama Anda di bawah."
              : `${totalRuns} run${totalRuns > items.length ? ` (${items.length} terbaru ditampilkan)` : ""} · brand terms dicek di jawaban AI untuk keyword komersial Anda.`}
          </p>
        </div>
        {items.length > 0 ? (
          <Button
            variant={formOpen ? "outline" : "default"}
            onClick={() => setFormOpen((v) => !v)}
          >
            {formOpen ? <X /> : <Plus />}
            {formOpen ? "Tutup" : "Cek baru"}
          </Button>
        ) : null}
      </div>

      {/* Form */}
      {formOpen ? (
      <div
        className={cn(
          lab.panel,
          "grid gap-3",
          "animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none",
        )}
      >
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
            <div className="flex flex-wrap items-center gap-1.5">
              {PLATFORM_KEYS.map((key) => {
                const active = platforms.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => togglePlatform(key)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                      active
                        ? "border-transparent " + AI_ENGINES[key].tint
                        : "border-border/70 bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <AiEngineLogo
                      engine={key}
                      monochrome={!active}
                      className="size-3.5"
                    />
                    {AI_ENGINES[key].label}
                    {active ? <Check className="size-3" /> : null}
                  </button>
                );
              })}
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
      ) : null}

      {items.length === 0 ? (
        <LabEmptyState
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
                  lab.card,
                  "flex items-center gap-2 p-3 text-left",
                  run.id === openRun?.id &&
                    "border-[color-mix(in_srgb,var(--lab-accent,var(--primary))_50%,transparent)]",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {run.name}
                  </span>
                  <span className="text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs">
                    {run.summary ? (
                      <>
                        <span>
                          {formatRate(
                            run.summary.totalChecks,
                            failedOf(run.summary),
                            run.summary.mentionRate,
                          )}{" "}
                          mention · {run.summary.totalChecks} cek
                        </span>
                        <FailedChip count={failedOf(run.summary)} />
                      </>
                    ) : (
                      `${run.keywords.length} keyword`
                    )}
                  </span>
                </span>
                <SeoStatusBadge status={run.status} />
              </button>
            ))}
          </div>

          {/* Detail run */}
          {openRun ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap gap-2.5">
                  {openRun.summary ? (
                    <>
                      {/* Tile hero mention rate */}
                      <div className="flex flex-col justify-center rounded-2xl bg-teal-600 px-4 py-2 text-white shadow-md shadow-teal-600/20 dark:bg-teal-500 dark:text-teal-950">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-teal-100 dark:text-teal-900/80">
                          Mention rate
                        </span>
                        <span className="flex items-baseline gap-2 text-xl font-extrabold tabular-nums tracking-tight">
                          {formatRate(
                            openRun.summary.totalChecks,
                            failedOf(openRun.summary),
                            openRun.summary.mentionRate,
                          )}
                          <FailedChip
                            count={failedOf(openRun.summary)}
                            className="bg-white/90 text-rose-700 dark:bg-teal-950/80 dark:text-rose-300"
                          />
                        </span>
                      </div>
                      {/* Tile per-platform dengan logo brand */}
                      {Object.entries(openRun.summary.byPlatform).map(
                        ([p, s]) => (
                          <div
                            key={p}
                            className="border-border/70 bg-card flex items-center gap-2.5 rounded-2xl border px-3.5 py-2 shadow-sm"
                          >
                            {isAiEngine(p) ? (
                              <AiEngineLogo engine={p} className="size-5" />
                            ) : null}
                            <span className="flex flex-col">
                              <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                                {aiEngineLabel(p)}
                              </span>
                              <span className="text-foreground flex items-baseline gap-1.5 text-lg font-extrabold leading-tight tabular-nums tracking-tight">
                                {formatRate(s.total, s.failed ?? 0, s.rate)}
                                <FailedChip count={s.failed ?? 0} />
                              </span>
                            </span>
                          </div>
                        ),
                      )}
                    </>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRerun(openRun.id)}
                    disabled={pending || !canRerun}
                    title={
                      canRerun
                        ? "Jalankan ulang — tiap cek menanyakan ulang ke AI (bukan dari cache)"
                        : "Run masih berjalan"
                    }
                  >
                    <RefreshCw />
                    {openRunStale ? "Jalankan ulang (macet)" : "Jalankan ulang"}
                  </Button>
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
              </div>

              <p className="text-muted-foreground text-[11px] leading-snug">
                1 sampel per keyword × platform; jawaban LLM bisa berbeda antar
                run.
                {failedOf(openRun.summary) > 0
                  ? " Cek yang gagal tidak dihitung dalam mention rate."
                  : ""}
              </p>

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

              {openRunBusy ? (
                <div className={cn(lab.card, "flex items-center gap-3 p-6")}>
                  <Loader2 className="text-primary size-5 animate-spin" />
                  <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                    <span className="text-muted-foreground">
                      Menanyakan {openRun.keywords.length} keyword ke
                    </span>
                    {openRun.platforms.map((p) => (
                      <AiEngineChip key={p} engine={p} />
                    ))}
                    <span className="text-muted-foreground">
                      … ({openRun.results.length} cek selesai)
                    </span>
                    {openRunStale ? (
                      <span className="text-amber-700 dark:text-amber-400">
                        Tidak ada progres &gt;15 menit — kemungkinan macet,
                        bisa dijalankan ulang.
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                {openRun.results.map((r, i) => (
                  <div key={i} className={cn(lab.card, "p-3")}>
                    <div className="flex flex-wrap items-center gap-2">
                      {r.error ? (
                        <Badge variant="destructive">gagal</Badge>
                      ) : r.mentioned ? (
                        <Check className="size-4 shrink-0 text-emerald-500" />
                      ) : (
                        <X className="size-4 shrink-0 text-red-500" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {r.keyword}
                      </span>
                      <AiEngineChip engine={r.platform} />
                      {r.matchedTerms.length > 0 ? (
                        <Badge variant="outline">
                          {r.matchedTerms.join(", ")}
                        </Badge>
                      ) : null}
                      {r.modelFallback ? (
                        <Badge
                          variant="outline"
                          title="Daftar model DataForSEO gagal dimuat; model fallback dipakai"
                          className="text-amber-700 dark:text-amber-400"
                        >
                          model fallback
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
