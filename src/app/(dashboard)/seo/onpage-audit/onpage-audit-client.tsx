"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import { ListChecks, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResearchHubEmptyState,
  ResearchHubSection,
  hub,
} from "@/components/research-hub/research-hub-primitives";
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import { isSeoStatusBusy, scoreToneClass } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createSeoOnPageAudit,
  deleteSeoOnPageAudit,
} from "@/actions/seo-onpage-audit";
import { cn } from "@/lib/utils";

export type AuditRow = {
  id: string;
  url: string;
  targetKeyword: string | null;
  status: SeoAnalysisStatus;
  score: number | null;
  errorMessage: string | null;
  createdAt: string;
};

export function OnPageAuditClient({ audits }: { audits: AuditRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState("");
  const [keyword, setKeyword] = useState("");

  const hasBusy = audits.some((a) => isSeoStatusBusy(a.status));
  useEffect(() => {
    if (!hasBusy) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [hasBusy, router]);

  function handleCreate() {
    if (!url.trim()) {
      toast.error("URL wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await createSeoOnPageAudit({
          url: url.trim(),
          targetKeyword: keyword.trim() || undefined,
        });
        setUrl("");
        setKeyword("");
        toast.success("Audit dimulai — berjalan di background.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memulai audit."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSeoOnPageAudit(id);
        toast.success("Audit dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <ResearchHubSection
        title="Audit baru"
        description="Masukkan URL halaman sendiri. Opsional: keyword target untuk analisis penggunaan keyword."
      >
        <div className={cn(hub.panel, "grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end")}>
          <div className="grid gap-1.5">
            <Label>URL halaman</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://brandanda.com/produk/serum"
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Keyword target (opsional)</Label>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="serum vitamin c"
              disabled={pending}
            />
          </div>
          <Button onClick={handleCreate} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Plus />}
            Audit
          </Button>
        </div>
      </ResearchHubSection>

      <ResearchHubSection title="Riwayat audit" description={`${audits.length} audit.`}>
        {audits.length === 0 ? (
          <ResearchHubEmptyState
            icon={ListChecks}
            title="Belum ada audit"
            description="Mulai audit pertama dengan memasukkan URL di atas."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {audits.map((a) => (
              <div
                key={a.id}
                className={cn(hub.card, "flex items-center gap-3 p-3")}
              >
                <div
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-xl border text-lg font-bold tabular-nums",
                    scoreToneClass(a.score),
                  )}
                >
                  {a.score ?? "—"}
                </div>
                <Link href={`/seo/onpage-audit/${a.id}`} className="min-w-0 flex-1">
                  <p className="text-foreground truncate font-medium hover:underline">
                    {a.url}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {a.targetKeyword ? `keyword: ${a.targetKeyword} · ` : ""}
                    {new Date(a.createdAt).toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
                  aria-label="Hapus audit"
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
