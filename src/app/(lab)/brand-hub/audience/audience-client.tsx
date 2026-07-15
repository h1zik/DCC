"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Plus, RefreshCw, Sparkles, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  createBrandAudienceProfile,
  deleteBrandAudienceProfile,
  regenerateBrandAudienceProfile,
} from "@/actions/brand-audience";
import { actionErrorMessage } from "@/lib/action-error-message";
import { BrandEvidencePanel } from "@/components/brand-hub/brand-evidence-panel";
import {
  BrandAudiencePersonaCard,
  type AudiencePersonaView,
} from "@/components/brand-hub/brand-audience-persona-card";
import { ActionPlanPanel } from "@/components/research-hub/action-plan-panel";
import {
  LabDocumentSidebar,
  LabDocumentSidebarItem,
  LabEmptyState,
  lab,
} from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBrandHubBrandId } from "@/hooks/use-brand-hub-brand-id";
import type { EvidenceReadiness } from "@/lib/brand-research/strategy/evidence-types";
import { cn } from "@/lib/utils";

export type AudienceProfileView = {
  id: string;
  status: string;
  version: number;
  ownerBrandId: string | null;
  category: string | null;
  pmBrief: string | null;
  personas: unknown;
  aiSummary: string | null;
  actionPlan: unknown;
  evidenceRefs: unknown;
  errorMessage: string | null;
  updatedAt: string;
};

const STATUS_META: Record<
  string,
  { label: string; pill: string; dot: string }
> = {
  READY: {
    label: "Siap",
    pill: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  GENERATING: {
    label: "Generating",
    pill: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500 animate-pulse",
  },
  DRAFT: {
    label: "Draft",
    pill: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
  FAILED: {
    label: "Gagal",
    pill: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
  },
};

function statusMeta(status: string) {
  return STATUS_META[status] ?? STATUS_META.DRAFT;
}

function toPersonas(raw: unknown): AudiencePersonaView[] {
  return Array.isArray(raw) ? (raw as AudiencePersonaView[]) : [];
}

export function BrandAudienceClient({
  profiles,
  evidenceReadiness,
  defaultBrandId,
}: {
  profiles: AudienceProfileView[];
  evidenceReadiness: EvidenceReadiness;
  defaultBrandId?: string | null;
}) {
  const router = useRouter();
  const brandId = useBrandHubBrandId(defaultBrandId);
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(
    profiles[0]?.id ?? null,
  );
  const [composeMode, setComposeMode] = useState(false);
  const [category, setCategory] = useState("");
  const [pmBrief, setPmBrief] = useState("");

  const selected = profiles.find((p) => p.id === selectedId) ?? null;
  const anyGenerating = profiles.some((p) => p.status === "GENERATING");

  // Refresh saat ada profil yang masih GENERATING (server action via after()).
  useEffect(() => {
    if (!anyGenerating) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 10_000);
    return () => window.clearInterval(id);
  }, [anyGenerating, router]);

  function handleGenerate() {
    startTransition(async () => {
      try {
        const res = await createBrandAudienceProfile({
          ownerBrandId: brandId,
          category: category.trim() || null,
          pmBrief: pmBrief.trim() || null,
        });
        toast.success("Generate persona dimulai — hasil muncul sebentar lagi.");
        setComposeMode(false);
        setCategory("");
        setPmBrief("");
        setSelectedId(res.id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memulai generate."));
      }
    });
  }

  function handleRegenerate(id: string) {
    startTransition(async () => {
      try {
        await regenerateBrandAudienceProfile(id);
        toast.success("Regenerate dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal regenerate."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteBrandAudienceProfile(id);
        toast.success("Profil dihapus.");
        if (selectedId === id) setSelectedId(null);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className={cn("flex flex-col gap-6 lg:flex-row", lab.entrance)}>
      <LabDocumentSidebar
        title="Profil Audiens"
        action={
          <Button
            size="sm"
            variant={composeMode ? "default" : "outline"}
            onClick={() => {
              setComposeMode(true);
              setSelectedId(null);
            }}
          >
            <Plus className="size-3.5" /> Baru
          </Button>
        }
      >
        {profiles.length === 0 ? (
          <p className="text-muted-foreground px-3 py-2 text-xs">
            Belum ada profil audiens.
          </p>
        ) : (
          profiles.map((p) => {
            const meta = statusMeta(p.status);
            return (
              <LabDocumentSidebarItem
                key={p.id}
                active={!composeMode && selectedId === p.id}
                onClick={() => {
                  setComposeMode(false);
                  setSelectedId(p.id);
                }}
                title={p.category || "Persona Audiens"}
                meta={new Date(p.updatedAt).toLocaleDateString("id-ID")}
                badge={
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      meta.pill,
                    )}
                  >
                    <span
                      className={cn("size-1 shrink-0 rounded-full", meta.dot)}
                      aria-hidden
                    />
                    {meta.label}
                  </span>
                }
              />
            );
          })
        )}
      </LabDocumentSidebar>

      <div className="min-w-0 flex-1 space-y-5">
        <BrandEvidencePanel
          readiness={evidenceReadiness}
          evidenceRefs={selected?.evidenceRefs}
          brandId={brandId}
        />

        {composeMode || !selected ? (
          <section className="bento-tile justify-start gap-4">
            <div>
              <span className="bento-label">Generate persona audiens</span>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                AI mensintesis review, social listening, dan keyword brand menjadi
                2-4 persona target market: pain point, harapan, motivasi, dan
                kebiasaan beli.
              </p>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="audience-category">Kategori produk</Label>
                <Input
                  id="audience-category"
                  placeholder="mis. parfum, body care"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="audience-brief">Brief / fokus (opsional)</Label>
                <Textarea
                  id="audience-brief"
                  placeholder="Constraint atau sudut pandang yang ingin ditekankan AI."
                  value={pmBrief}
                  onChange={(e) => setPmBrief(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleGenerate}
                disabled={pending || !evidenceReadiness.canGenerate}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Generate Persona
              </Button>
              {!evidenceReadiness.canGenerate ? (
                <p className="text-muted-foreground text-xs">
                  Lengkapi evidence di atas (Review Intel / Social Listening)
                  sebelum generate.
                </p>
              ) : null}
            </div>
          </section>
        ) : (
          <AudienceDetail
            profile={selected}
            pending={pending}
            onRegenerate={() => handleRegenerate(selected.id)}
            onDelete={() => handleDelete(selected.id)}
          />
        )}
      </div>
    </div>
  );
}

function AudienceDetail({
  profile,
  pending,
  onRegenerate,
  onDelete,
}: {
  profile: AudienceProfileView;
  pending: boolean;
  onRegenerate: () => void;
  onDelete: () => void;
}) {
  const personas = toPersonas(profile.personas);
  const isGenerating = profile.status === "GENERATING";
  const meta = statusMeta(profile.status);

  // Agregat murah dari data yang sudah di-fetch.
  const evidenceCount = Array.isArray(profile.evidenceRefs)
    ? profile.evidenceRefs.length
    : 0;
  const quoteCount = personas.reduce(
    (acc, p) => acc + (p.representativeQuotes?.length ?? 0),
    0,
  );

  return (
    <div className="space-y-5">
      {/* Toolbar profil */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={lab.sectionTitle}>
            {profile.category || "Persona Audiens"}
          </h2>
          <p className="text-muted-foreground text-xs">
            Diperbarui{" "}
            {new Date(profile.updatedAt).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onRegenerate}
            disabled={pending || isGenerating}
          >
            <RefreshCw className="size-3.5" /> Regenerate
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={pending}
            aria-label="Hapus profil"
          >
            <Trash2 className="text-destructive size-3.5" />
          </Button>
        </div>
      </div>

      {profile.status === "FAILED" ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400">
          {profile.errorMessage ?? "Generasi gagal. Coba regenerate."}
        </div>
      ) : null}

      {/* Papan bento profil */}
      <div className="grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 md:grid-cols-4">
        {/* Hero pink — jumlah persona */}
        <div className="bento-tile col-span-2 row-span-2 border-transparent bg-pink-600 shadow-md shadow-pink-600/20 dark:bg-pink-500">
          <span className="text-[11.5px] font-semibold text-pink-100 dark:text-pink-950/70">
            Persona
          </span>
          <span className="bento-value text-5xl text-white dark:text-pink-950">
            {personas.length}
          </span>
          <span className="text-xs font-medium leading-snug text-pink-100/90 dark:text-pink-900/80">
            {isGenerating
              ? "AI sedang menyusun persona dari voice-of-customer…"
              : "target market hasil sintesis review, social listening & keyword"}
          </span>
        </div>

        <div className="bento-tile">
          <span className="bento-label">Status</span>
          <span
            className={cn(
              "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
              meta.pill,
            )}
          >
            <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
            {meta.label}
          </span>
          <span className="text-muted-foreground text-[11px] font-medium">
            {new Date(profile.updatedAt).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>

        <div className="bento-tile">
          <span className="bento-label">Versi</span>
          <span className="bento-value">v{profile.version}</span>
        </div>

        <div className="bento-tile border-transparent bg-[#fde7f1] dark:bg-pink-400/10">
          <span className="text-[11.5px] font-semibold text-pink-800/70 dark:text-pink-200/60">
            Evidence AI
          </span>
          <span className="bento-value text-pink-900 dark:text-pink-300">
            {evidenceCount}
          </span>
          <span className="text-[11px] font-medium text-pink-900/60 dark:text-pink-200/50">
            kutipan data yang dipakai AI
          </span>
        </div>

        <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
          <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
            Kutipan konsumen
          </span>
          <span className="bento-value text-amber-900 dark:text-amber-300">
            {quoteCount}
          </span>
          <span className="text-[11px] font-medium text-amber-900/60 dark:text-amber-200/50">
            suara asli di semua persona
          </span>
        </div>
      </div>

      {isGenerating ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> AI sedang menyusun persona…
        </div>
      ) : null}

      {profile.aiSummary ? (
        <div className="bento-tile justify-start gap-2">
          <span className="bento-label">Ringkasan AI</span>
          <p className="text-sm leading-relaxed">{profile.aiSummary}</p>
        </div>
      ) : null}

      {personas.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {personas.map((p, i) => (
            <BrandAudiencePersonaCard key={i} persona={p} />
          ))}
        </div>
      ) : !isGenerating && profile.status === "READY" ? (
        <LabEmptyState
          icon={Users}
          title="Belum ada persona"
          description="AI tidak menghasilkan persona — coba regenerate."
        />
      ) : null}

      {profile.actionPlan ? (
        <ActionPlanPanel
          plan={profile.actionPlan}
          title="Implikasi untuk Brand & Marketing"
        />
      ) : null}
    </div>
  );
}
