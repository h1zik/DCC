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
  BrandHubDocumentSidebar,
  BrandHubEmptyState,
  BrandHubSidebarItem,
  hub,
} from "@/components/brand-hub/brand-hub-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

const STATUS_TONE: Record<string, string> = {
  READY: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  GENERATING: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  DRAFT: "bg-muted/60 text-muted-foreground",
  FAILED: "bg-red-500/10 text-red-600 dark:text-red-400",
};

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

  const showWorkspace = composeMode || selected !== null;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <BrandHubDocumentSidebar
        title="Profil Audiens"
        action={
          <Button
            size="sm"
            variant="outline"
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
          profiles.map((p) => (
            <BrandHubSidebarItem
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
                    "rounded px-1.5 py-0.5 text-[10px] font-medium",
                    STATUS_TONE[p.status] ?? STATUS_TONE.DRAFT,
                  )}
                >
                  {p.status}
                </span>
              }
            />
          ))
        )}
      </BrandHubDocumentSidebar>

      <div className="min-w-0 flex-1 space-y-6">
        <BrandEvidencePanel
          readiness={evidenceReadiness}
          evidenceRefs={selected?.evidenceRefs}
          brandId={brandId}
        />

        {composeMode || !selected ? (
          <section className={cn(hub.panel, "space-y-4")}>
            <div>
              <h3 className={hub.sectionTitle}>Generate Persona Audiens</h3>
              <p className={hub.sectionDesc}>
                AI mensintesis review, social listening, dan keyword brand menjadi
                2-4 persona target market: pain point, harapan, motivasi, dan
                kebiasaan beli.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="audience-category">Kategori produk</Label>
                <Input
                  id="audience-category"
                  placeholder="mis. parfum, body care"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
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
                Lengkapi evidence di atas (Review Intel / Social Listening) sebelum
                generate.
              </p>
            ) : null}
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className={hub.sectionTitle}>
            {profile.category || "Persona Audiens"}
          </h2>
          <Badge variant="secondary" className="text-xs">
            v{profile.version}
          </Badge>
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
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {profile.status === "FAILED" ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {profile.errorMessage ?? "Generasi gagal. Coba regenerate."}
        </div>
      ) : null}

      {isGenerating ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> AI sedang menyusun persona…
        </div>
      ) : null}

      {profile.aiSummary ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {profile.aiSummary}
        </p>
      ) : null}

      {personas.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {personas.map((p, i) => (
            <BrandAudiencePersonaCard key={i} persona={p} />
          ))}
        </div>
      ) : !isGenerating && profile.status === "READY" ? (
        <BrandHubEmptyState
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
