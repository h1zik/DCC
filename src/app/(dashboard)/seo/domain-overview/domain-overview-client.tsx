"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import { Globe, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import {
  ResearchHubEmptyState,
  hub,
} from "@/components/research-hub/research-hub-primitives";
import { isSeoStatusBusy } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createSeoDomainOverview,
  deleteSeoDomainOverview,
} from "@/actions/seo-domain-overview";
import { cn } from "@/lib/utils";

export type DomainOverviewRow = {
  id: string;
  target: string;
  status: SeoAnalysisStatus;
  organicTraffic: number | null;
  organicKeywords: number | null;
  errorMessage: string | null;
  createdAt: string;
};

export function DomainOverviewClient({ items }: { items: DomainOverviewRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState("");

  const hasBusy = items.some((i) => isSeoStatusBusy(i.status));
  useEffect(() => {
    if (!hasBusy) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [hasBusy, router]);

  function handleCreate() {
    if (!target.trim()) {
      toast.error("Domain wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        const { id } = await createSeoDomainOverview({ target: target.trim() });
        setTarget("");
        toast.success("Analisis domain dimulai.");
        router.push(`/seo/domain-overview/${id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memulai analisis."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSeoDomainOverview(id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className={cn(hub.panel, "grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end")}>
        <div className="grid gap-1.5">
          <Label>Domain (milik sendiri atau kompetitor)</Label>
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="mis. kompetitor.co.id"
            disabled={pending}
          />
        </div>
        <Button onClick={handleCreate} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Search />}
          Analisis
        </Button>
      </div>

      {items.length === 0 ? (
        <ResearchHubEmptyState
          icon={Globe}
          title="Belum ada analisis domain"
          description="Masukkan domain apa pun untuk melihat potret organiknya di Google Indonesia."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/seo/domain-overview/${item.id}`}
              className={cn(hub.card, "flex items-center gap-3 p-4 hover:border-primary/40")}
            >
              <Globe className="text-muted-foreground size-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.target}</span>
                <span className="text-muted-foreground block text-xs">
                  {item.organicKeywords != null
                    ? `${item.organicKeywords.toLocaleString("id-ID")} keyword organik · ~${(item.organicTraffic ?? 0).toLocaleString("id-ID")} trafik/bln`
                    : item.errorMessage ?? "—"}
                </span>
              </span>
              <SeoStatusBadge status={item.status} />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete(item.id);
                }}
                disabled={pending}
                aria-label="Hapus"
              >
                <Trash2 className="text-destructive" />
              </Button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
