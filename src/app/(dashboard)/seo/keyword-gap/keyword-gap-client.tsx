"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import { Loader2, Swords, Trash2 } from "lucide-react";
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
  createSeoKeywordGap,
  deleteSeoKeywordGap,
} from "@/actions/seo-keyword-gap";
import { cn } from "@/lib/utils";

export type KeywordGapRow = {
  id: string;
  name: string;
  target: string;
  competitors: string[];
  status: SeoAnalysisStatus;
  missing: number | null;
  weak: number | null;
  errorMessage: string | null;
  createdAt: string;
};

export function KeywordGapClient({
  items,
  prefillTarget,
  prefillCompetitor,
}: {
  items: KeywordGapRow[];
  prefillTarget: string;
  prefillCompetitor: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [target, setTarget] = useState(prefillTarget);
  const [competitors, setCompetitors] = useState(prefillCompetitor);

  const hasBusy = items.some((i) => isSeoStatusBusy(i.status));
  useEffect(() => {
    if (!hasBusy) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [hasBusy, router]);

  function handleCreate() {
    const compList = competitors
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!target.trim() || compList.length === 0) {
      toast.error("Domain target & minimal satu kompetitor wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        const { id } = await createSeoKeywordGap({
          name: name.trim() || `${target.trim()} vs ${compList[0]}`,
          target: target.trim(),
          competitors: compList.slice(0, 3),
        });
        setName("");
        toast.success("Analisis keyword gap dimulai.");
        router.push(`/seo/keyword-gap/${id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memulai analisis."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSeoKeywordGap(id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className={cn(hub.panel, "grid gap-3")}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label>Nama analisis (opsional)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Gap vs kompetitor utama"
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Domain Anda</Label>
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="brandanda.com"
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Kompetitor (maks 3, pisah koma)</Label>
            <Input
              value={competitors}
              onChange={(e) => setCompetitors(e.target.value)}
              placeholder="komp-a.com, komp-b.co.id"
              disabled={pending}
            />
          </div>
        </div>
        <div>
          <Button onClick={handleCreate} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Swords />}
            Analisis gap
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <ResearchHubEmptyState
          icon={Swords}
          title="Belum ada analisis gap"
          description="Bandingkan domain Anda dengan kompetitor untuk menemukan keyword yang belum Anda garap."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/seo/keyword-gap/${item.id}`}
              className={cn(hub.card, "flex items-center gap-3 p-4 hover:border-primary/40")}
            >
              <Swords className="text-muted-foreground size-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.name}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {item.target} vs {item.competitors.join(", ")}
                  {item.missing != null
                    ? ` · ${item.missing} missing · ${item.weak ?? 0} weak`
                    : ""}
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
