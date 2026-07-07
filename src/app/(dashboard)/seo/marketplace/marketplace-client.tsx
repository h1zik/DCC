"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResearchMarketplace, SeoAnalysisStatus } from "@prisma/client";
import { Loader2, Plus, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  ResearchHubEmptyState,
  ResearchHubSection,
  hub,
} from "@/components/research-hub/research-hub-primitives";
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import { isSeoStatusBusy, scoreToneClass } from "@/lib/seo/labels";
import type { SelectItemDef } from "@/lib/select-option-items";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createSeoMarketplaceAnalysis,
  deleteSeoMarketplaceAnalysis,
} from "@/actions/seo-marketplace";
import { cn } from "@/lib/utils";

export const MARKETPLACE_LABELS: Record<string, string> = {
  SHOPEE: "Shopee",
  TOKOPEDIA: "Tokopedia",
  LAZADA: "Lazada",
};

const SUPPORTED = [
  ResearchMarketplace.SHOPEE,
  ResearchMarketplace.TOKOPEDIA,
  ResearchMarketplace.LAZADA,
];

const MARKETPLACE_ITEMS: SelectItemDef[] = SUPPORTED.map((m) => ({
  value: m,
  label: MARKETPLACE_LABELS[m],
}));

export type MarketplaceRow = {
  id: string;
  keyword: string;
  marketplace: ResearchMarketplace;
  status: SeoAnalysisStatus;
  optimizationScore: number | null;
  hasOwnTitle: boolean;
  errorMessage: string | null;
  createdAt: string;
};

export function MarketplaceClient({ analyses }: { analyses: MarketplaceRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [keyword, setKeyword] = useState("");
  const [marketplace, setMarketplace] = useState<ResearchMarketplace>(
    ResearchMarketplace.SHOPEE,
  );
  const [ownTitle, setOwnTitle] = useState("");

  const hasBusy = analyses.some((a) => isSeoStatusBusy(a.status));
  useEffect(() => {
    if (!hasBusy) return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [hasBusy, router]);

  function handleCreate() {
    if (!keyword.trim()) {
      toast.error("Keyword wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await createSeoMarketplaceAnalysis({
          keyword: keyword.trim(),
          marketplace,
          ownTitle: ownTitle.trim() || undefined,
        });
        setKeyword("");
        setOwnTitle("");
        toast.success("Analisis dimulai — scraping berjalan di background.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memulai analisis."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSeoMarketplaceAnalysis(id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <ResearchHubSection
        title="Analisis baru"
        description="Masukkan keyword pencarian marketplace. Opsional: judul produkmu untuk skor optimasi."
      >
        <div className={cn(hub.panel, "grid gap-3 sm:grid-cols-2")}>
          <div className="grid gap-1.5">
            <Label>Keyword</Label>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="serum vitamin c"
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Marketplace</Label>
            <Select
              value={marketplace}
              items={MARKETPLACE_ITEMS}
              onValueChange={(v) => {
                if (v) setMarketplace(v as ResearchMarketplace);
              }}
            >
              <SelectTrigger>{MARKETPLACE_LABELS[marketplace]}</SelectTrigger>
              <SelectContent>
                {SUPPORTED.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MARKETPLACE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Judul produk sendiri (opsional)</Label>
            <Input
              value={ownTitle}
              onChange={(e) => setOwnTitle(e.target.value)}
              placeholder="Serum Vitamin C 20% Brightening Original BPOM 30ml"
              disabled={pending}
            />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={handleCreate} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Plus />}
              Analisis
            </Button>
          </div>
        </div>
      </ResearchHubSection>

      <ResearchHubSection title="Riwayat analisis" description={`${analyses.length} analisis.`}>
        {analyses.length === 0 ? (
          <ResearchHubEmptyState
            icon={Store}
            title="Belum ada analisis"
            description="Mulai analisis marketplace SEO pertama di atas."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {analyses.map((a) => (
              <div key={a.id} className={cn(hub.card, "flex items-center gap-3 p-3")}>
                {a.hasOwnTitle ? (
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold tabular-nums",
                      scoreToneClass(a.optimizationScore),
                    )}
                  >
                    {a.optimizationScore ?? "—"}
                  </div>
                ) : null}
                <Link href={`/seo/marketplace/${a.id}`} className="min-w-0 flex-1">
                  <p className="text-foreground truncate font-medium hover:underline">
                    {a.keyword}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {MARKETPLACE_LABELS[a.marketplace] ?? a.marketplace}
                  </p>
                  {a.status === SeoAnalysisStatus.FAILED && a.errorMessage ? (
                    <p className="text-destructive truncate text-xs">
                      {a.errorMessage}
                    </p>
                  ) : null}
                </Link>
                <SeoStatusBadge status={a.status} />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(a.id)}
                  disabled={pending}
                  aria-label="Hapus"
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ResearchHubSection>
    </div>
  );
}
