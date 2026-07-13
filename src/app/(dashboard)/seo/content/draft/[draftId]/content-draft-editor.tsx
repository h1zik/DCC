"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  Download,
  Gauge,
  Link2,
  Loader2,
  Play,
  Save,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RichTextEditor } from "@/components/rich-text-editor";
import { SeoDetailPage } from "@/components/seo/seo-module-page";
import { hub } from "@/components/research-hub/research-hub-primitives";
import { isSeoStatusBusy, scoreToneClass } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  analyzeDraftAction,
  checkDraftOriginality,
  resumeDraftGenerationAction,
  saveContentDraft,
} from "@/actions/seo-content";
import {
  analyzeContentV2,
  hasUsableGrounding,
  type ContentAnalysisV2,
  type ScoreGrounding,
} from "@/lib/seo/content/content-score-v2";
import { extractSignalsFromDom } from "@/lib/seo/content/html-signals";
import { cn } from "@/lib/utils";

type ContentCheck = {
  id: string;
  label: string;
  passed: boolean;
  hint: string;
};

export type DraftDetail = {
  id: string;
  title: string;
  targetKeyword: string | null;
  contentHtml: string;
  score: number | null;
  analysis: {
    version?: number;
    checks?: ContentCheck[];
    density?: number;
    structure?: {
      wordCount?: number;
      h1Count?: number;
      h2Count?: number;
      avgWordsPerSentence?: number | null;
    };
    suggestions?: string[];
    claimWarnings?: string[];
    claims?: string[];
    originality?: {
      score: number;
      sampledCount: number;
      matchedCount: number;
      matches: { sentence: string; url: string; title: string | null }[];
      checkedAt: string;
    };
  } | null;
  briefId: string | null;
  status: SeoAnalysisStatus;
  stepLabel: string | null;
  percent: number;
  errorMessage: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  slug: string | null;
  internalLinks: { anchorText: string; url: string; reason: string }[];
};

export function ContentDraftEditor({
  draft,
  grounding,
}: {
  draft: DraftDetail;
  grounding: ScoreGrounding | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(draft.title);
  const [keyword, setKeyword] = useState(draft.targetKeyword ?? "");
  const [metaTitle, setMetaTitle] = useState(draft.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(
    draft.metaDescription ?? "",
  );
  const [slug, setSlug] = useState(draft.slug ?? "");
  const htmlRef = useRef(draft.contentHtml);
  const [live, setLive] = useState<ContentAnalysisV2 | null>(null);
  const debounceRef = useRef<number | null>(null);

  const busy = isSeoStatusBusy(draft.status);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [busy, router]);

  const usableGrounding = useMemo(
    () => (grounding && hasUsableGrounding(grounding) ? grounding : null),
    [grounding],
  );

  const runLiveScore = useCallback(
    (html: string, currentTitle: string) => {
      if (!usableGrounding) return;
      const signals = extractSignalsFromDom(html);
      setLive(
        analyzeContentV2(
          signals,
          {
            title: currentTitle,
            metaTitle: metaTitle || null,
            metaDescription: metaDescription || null,
            slug: slug || null,
          },
          usableGrounding,
        ),
      );
    },
    [usableGrounding, metaTitle, metaDescription, slug],
  );

  // Skor awal saat mount / setelah generate selesai.
  useEffect(() => {
    if (!busy) runLiveScore(htmlRef.current, title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, usableGrounding]);

  const onUpdate = useCallback(
    (html: string) => {
      htmlRef.current = html;
      if (!usableGrounding) return;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(
        () => runLiveScore(html, title),
        600,
      );
    },
    [usableGrounding, runLiveScore, title],
  );

  async function persist() {
    await saveContentDraft({
      draftId: draft.id,
      title: title.trim() || "Tanpa judul",
      targetKeyword: keyword.trim() || undefined,
      contentHtml: htmlRef.current,
      metaTitle: metaTitle.trim() || undefined,
      metaDescription: metaDescription.trim() || undefined,
      slug: slug.trim() || undefined,
    });
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await persist();
        toast.success("Draft disimpan.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan."));
      }
    });
  }

  function handleAnalyze() {
    startTransition(async () => {
      try {
        await persist();
        await analyzeDraftAction(draft.id);
        toast.success("Analisis selesai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menganalisis."));
      }
    });
  }

  const [checkingOriginality, setCheckingOriginality] = useState(false);

  function handleCheckOriginality() {
    setCheckingOriginality(true);
    startTransition(async () => {
      try {
        await persist();
        const report = await checkDraftOriginality(draft.id);
        toast.success(
          `Orisinalitas: ${report.score}/100 (${report.matchedCount}/${report.sampledCount} kalimat ditemukan di web).`,
        );
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal cek orisinalitas."));
      } finally {
        setCheckingOriginality(false);
      }
    });
  }

  function handleResume() {
    startTransition(async () => {
      try {
        await resumeDraftGenerationAction(draft.id);
        toast.success("Penulisan dilanjutkan.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal melanjutkan."));
      }
    });
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} disalin.`);
    } catch {
      toast.error("Gagal menyalin.");
    }
  }

  const analysis = draft.analysis;
  const score = live?.score ?? draft.score;
  const checks: ContentCheck[] = live?.checks ?? analysis?.checks ?? [];
  const suggestions = analysis?.suggestions ?? [];
  const claimWarnings = analysis?.claimWarnings ?? [];
  const verifyMarkers = analysis?.claims ?? [];
  const termReport = live?.termReport ?? [];
  const categories = live?.categories ?? [];
  const wordCount = live
    ? undefined
    : analysis?.structure?.wordCount;

  /* --------------------------- panel saat generate --------------------------- */
  if (busy) {
    return (
      <SeoDetailPage
        title="Editor Draft"
        description={
          draft.targetKeyword ? `Keyword: "${draft.targetKeyword}"` : undefined
        }
        right={
          <Button variant="ghost" size="sm" render={<Link href={draft.briefId ? `/seo/content/${draft.briefId}` : "/seo/content"} />}>
            <ArrowLeft />
            Kembali
          </Button>
        }
      >
        <div className={cn(hub.card, "flex flex-col items-center gap-4 p-10")}>
          <Loader2 className="text-primary size-8 animate-spin" />
          <div className="text-center">
            <p className="font-medium">
              {draft.stepLabel ?? "Menulis artikel…"}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              AI sedang menulis artikel section per section dari brief.
              Halaman ter-update otomatis — Anda boleh meninggalkan halaman ini.
            </p>
          </div>
          <Progress value={draft.percent} className="max-w-sm" />
        </div>
      </SeoDetailPage>
    );
  }

  return (
    <SeoDetailPage
      title="Editor Draft"
      description={draft.targetKeyword ? `Keyword: "${draft.targetKeyword}"` : undefined}
      right={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            Simpan
          </Button>
          <Button size="sm" onClick={handleAnalyze} disabled={pending}>
            <Sparkles />
            Analisis AI
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckOriginality}
            disabled={pending || checkingOriginality}
            title="Sampel kalimat dicek sebagai frasa persis di Google"
          >
            {checkingOriginality ? (
              <Loader2 className="animate-spin" />
            ) : (
              <ShieldAlert />
            )}
            Orisinalitas
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
              )}
            >
              <Download />
              Ekspor
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => copyToClipboard(htmlRef.current, "HTML")}
              >
                <Copy className="size-4" /> Salin HTML
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  window.location.assign(
                    `/api/seo/content/draft/${draft.id}/export?format=html`,
                  )
                }
              >
                Unduh HTML
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  window.location.assign(
                    `/api/seo/content/draft/${draft.id}/export?format=md`,
                  )
                }
              >
                Unduh Markdown
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  window.location.assign(
                    `/api/seo/content/draft/${draft.id}/export?format=docx`,
                  )
                }
              >
                Unduh DOCX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            render={
              <Link href={draft.briefId ? `/seo/content/${draft.briefId}` : "/seo/content"} />
            }
          >
            <ArrowLeft />
            Kembali
          </Button>
        </div>
      }
    >
      {draft.status === SeoAnalysisStatus.FAILED ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <span className="text-destructive">
            {draft.errorMessage ?? "Penulisan draft gagal."}
          </span>
          {draft.briefId ? (
            <Button size="sm" variant="outline" onClick={handleResume} disabled={pending}>
              <Play />
              Lanjutkan penulisan
            </Button>
          ) : null}
        </div>
      ) : null}

      {claimWarnings.length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <p className="mb-1 flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400">
            <ShieldAlert className="size-4" /> Klaim berisiko (etika iklan BPOM)
          </p>
          <ul className="text-muted-foreground ml-5 list-disc">
            {claimWarnings.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {analysis?.originality ? (
        <div
          className={cn(
            "rounded-xl border p-4 text-sm",
            analysis.originality.score >= 90
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-amber-500/30 bg-amber-500/5",
          )}
        >
          <p className="mb-1 font-semibold">
            Orisinalitas: {analysis.originality.score}/100{" "}
            <span className="text-muted-foreground font-normal">
              ({analysis.originality.matchedCount}/
              {analysis.originality.sampledCount} kalimat sampel ditemukan persis
              di web)
            </span>
          </p>
          {analysis.originality.matches.length > 0 ? (
            <ul className="text-muted-foreground ml-5 list-disc">
              {analysis.originality.matches.slice(0, 5).map((m, i) => (
                <li key={i}>
                  “{m.sentence.slice(0, 90)}…” —{" "}
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {m.title ?? m.url}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              Tidak ada kalimat sampel yang ditemukan persis di halaman lain.
            </p>
          )}
        </div>
      ) : null}

      {verifyMarkers.length > 0 ? (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 text-sm">
          <p className="mb-1 flex items-center gap-2 font-semibold text-sky-700 dark:text-sky-400">
            <AlertTriangle className="size-4" /> Perlu verifikasi manusia
          </p>
          <ul className="text-muted-foreground ml-5 list-disc">
            {verifyMarkers.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Editor */}
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Judul</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Keyword target</Label>
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="serum vitamin c"
                disabled={pending}
              />
            </div>
          </div>
          <div className={cn(hub.card, "p-4")}>
            <RichTextEditor
              initialContent={draft.contentHtml}
              onUpdate={onUpdate}
              placeholder="Tulis atau tempel artikel di sini…"
            />
          </div>

          {/* Meta panel */}
          <div className={cn(hub.card, "p-4")}>
            <p className="mb-3 font-semibold">Meta & slug (siap pakai)</p>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label>
                    Meta title{" "}
                    <span
                      className={cn(
                        "tabular-nums",
                        metaTitle.length > 60
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      ({metaTitle.length}/60)
                    </span>
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(metaTitle, "Meta title")}
                  >
                    <Copy />
                  </Button>
                </div>
                <Input
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label>
                    Meta description{" "}
                    <span
                      className={cn(
                        "tabular-nums",
                        metaDescription.length > 160
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      ({metaDescription.length}/160)
                    </span>
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(metaDescription, "Meta description")
                    }
                  >
                    <Copy />
                  </Button>
                </div>
                <Textarea
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  rows={2}
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label>Slug</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(slug, "Slug")}
                  >
                    <Copy />
                  </Button>
                </div>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="serum-niacinamide-terbaik"
                  disabled={pending}
                />
              </div>
            </div>
          </div>

          {draft.internalLinks.length > 0 ? (
            <div className={cn(hub.card, "p-4")}>
              <p className="mb-1 flex items-center gap-2 font-semibold">
                <Link2 className="size-4" /> Saran internal link
              </p>
              <p className="text-muted-foreground mb-3 text-xs">
                Dari halaman Anda yang sudah ranking/teraudit — sisipkan manual
                di teks yang relevan.
              </p>
              <div className="flex flex-col gap-2">
                {draft.internalLinks.map((l) => (
                  <div key={l.url} className={cn(hub.nestedPanel, "text-sm")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {l.anchorText}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {l.url}
                        </span>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(
                            `<a href="${l.url}">${l.anchorText}</a>`,
                            "Link",
                          )
                        }
                      >
                        <Copy />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Panel skor */}
        <div className="flex flex-col gap-4">
          <div className={cn(hub.card, "flex flex-col items-center gap-1 p-5")}>
            <span className="text-muted-foreground text-xs uppercase tracking-wide">
              Skor SEO {live ? "(live)" : ""}
            </span>
            <span
              className={cn(
                "text-5xl font-bold tabular-nums",
                scoreToneClass(score),
              )}
            >
              {score ?? "—"}
            </span>
            <span className="text-muted-foreground text-xs">dari 100</span>
            {categories.length > 0 ? (
              <div className="mt-3 w-full space-y-1.5">
                {categories.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-28 shrink-0 truncate">
                      {c.label}
                    </span>
                    <Progress value={c.score} className="h-1.5" />
                    <span className="w-7 shrink-0 text-right tabular-nums">
                      {c.score}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {usableGrounding ? (
            <Tabs defaultValue="terms">
              <TabsList className="w-full">
                <TabsTrigger value="terms" className="flex-1">
                  Istilah
                </TabsTrigger>
                <TabsTrigger value="questions" className="flex-1">
                  Tanya
                </TabsTrigger>
                <TabsTrigger value="checks" className="flex-1">
                  Cek
                </TabsTrigger>
                <TabsTrigger value="ai" className="flex-1">
                  AI
                </TabsTrigger>
              </TabsList>

              <TabsContent value="terms">
                <div className={cn(hub.card, "p-4")}>
                  {termReport.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Mulai mengetik — skor istilah ter-update otomatis.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {termReport.map((t) => (
                        <div
                          key={t.term}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span
                            className={cn(
                              "min-w-0 truncate",
                              t.status === "in_range"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : t.status === "over"
                                  ? "text-amber-600 dark:text-amber-400"
                                  : t.status === "under"
                                    ? "text-sky-600 dark:text-sky-400"
                                    : "text-muted-foreground",
                            )}
                          >
                            {t.term}
                          </span>
                          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                            {t.count}/{t.targetMin}–{t.targetMax}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="questions">
                <div className={cn(hub.card, "p-4")}>
                  {usableGrounding.paaQuestions.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Tidak ada data People Also Ask untuk keyword ini.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {usableGrounding.paaQuestions.map((q) => (
                        <li key={q} className="text-sm">
                          {q}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="checks">
                <div className={cn(hub.card, "p-4")}>
                  <ChecksList checks={checks} />
                </div>
              </TabsContent>

              <TabsContent value="ai">
                <div className={cn(hub.card, "p-4")}>
                  {suggestions.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Klik “Analisis AI” untuk saran reviewer + cek klaim BPOM.
                    </p>
                  ) : (
                    <ul className="text-muted-foreground ml-4 list-disc text-sm">
                      {suggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <>
              <div className={cn(hub.card, "p-4")}>
                <div className="mb-2 flex items-center gap-2">
                  <Gauge className="size-4 text-primary" />
                  <p className="font-semibold">Checklist</p>
                </div>
                {checks.length > 0 ? (
                  <ChecksList checks={checks} />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Klik “Analisis AI” untuk menilai draft.
                    {wordCount != null ? ` (${wordCount} kata)` : ""}
                  </p>
                )}
              </div>
              {suggestions.length > 0 ? (
                <div className={hub.panel}>
                  <p className={cn(hub.label, "mb-2")}>Saran AI</p>
                  <ul className="text-muted-foreground ml-4 list-disc text-sm">
                    {suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </SeoDetailPage>
  );
}

function ChecksList({ checks }: { checks: ContentCheck[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {checks.map((c) => (
        <li key={c.id} className="flex items-start gap-2 text-sm">
          {c.passed ? (
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
          ) : (
            <X className="mt-0.5 size-4 shrink-0 text-red-500" />
          )}
          <span className="min-w-0">
            {c.label}
            {!c.passed && c.hint ? (
              <span className="text-muted-foreground block text-xs">{c.hint}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
