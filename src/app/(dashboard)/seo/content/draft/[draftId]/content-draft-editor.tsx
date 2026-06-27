"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Gauge, Loader2, Save, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/rich-text-editor";
import { SeoDetailPage } from "@/components/seo/seo-module-page";
import { hub } from "@/components/research-hub/research-hub-primitives";
import { scoreToneClass } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import { analyzeDraftAction, saveContentDraft } from "@/actions/seo-content";
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
    checks?: ContentCheck[];
    density?: number;
    structure?: {
      wordCount?: number;
      h1Count?: number;
      h2Count?: number;
      avgWordsPerSentence?: number | null;
    };
    suggestions?: string[];
  } | null;
  briefId: string | null;
};

export function ContentDraftEditor({ draft }: { draft: DraftDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(draft.title);
  const [keyword, setKeyword] = useState(draft.targetKeyword ?? "");
  const htmlRef = useRef(draft.contentHtml);

  const onUpdate = useCallback((html: string) => {
    htmlRef.current = html;
  }, []);

  async function persist() {
    await saveContentDraft({
      draftId: draft.id,
      title: title.trim() || "Tanpa judul",
      targetKeyword: keyword.trim() || undefined,
      contentHtml: htmlRef.current,
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

  const analysis = draft.analysis;
  const checks = analysis?.checks ?? [];
  const structure = analysis?.structure ?? {};
  const suggestions = analysis?.suggestions ?? [];

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
            Analisis SEO
          </Button>
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
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
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
        </div>

        {/* Panel analisis */}
        <div className="flex flex-col gap-4">
          <div className={cn(hub.card, "flex flex-col items-center gap-1 p-5")}>
            <span className="text-muted-foreground text-xs uppercase tracking-wide">
              Skor SEO
            </span>
            <span
              className={cn(
                "text-5xl font-bold tabular-nums",
                scoreToneClass(draft.score),
              )}
            >
              {draft.score ?? "—"}
            </span>
            <span className="text-muted-foreground text-xs">dari 100</span>
          </div>

          {analysis ? (
            <>
              <div className={cn(hub.card, "p-4")}>
                <div className="mb-2 flex items-center gap-2">
                  <Gauge className="size-4 text-primary" />
                  <p className="font-semibold">Statistik</p>
                </div>
                <div className="text-muted-foreground grid grid-cols-2 gap-2 text-sm">
                  <span>Kata: {structure.wordCount ?? "—"}</span>
                  <span>
                    Densitas:{" "}
                    {analysis.density != null
                      ? `${(analysis.density * 100).toFixed(2)}%`
                      : "—"}
                  </span>
                  <span>H1: {structure.h1Count ?? "—"}</span>
                  <span>H2: {structure.h2Count ?? "—"}</span>
                </div>
              </div>

              <div className={cn(hub.card, "p-4")}>
                <p className="mb-2 font-semibold">Checklist</p>
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
                          <span className="text-muted-foreground block text-xs">
                            {c.hint}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
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
          ) : (
            <p className="text-muted-foreground text-sm">
              Klik “Analisis SEO” untuk menilai keyword usage, readability, dan
              struktur.
            </p>
          )}
        </div>
      </div>
    </SeoDetailPage>
  );
}
