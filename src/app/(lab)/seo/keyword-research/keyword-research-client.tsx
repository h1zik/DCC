"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  LabEmptyState,
  LabSection,
  lab,
} from "@/components/lab/lab-primitives";
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import { isSeoStatusBusy } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createSeoKeywordProject,
  deleteSeoKeywordProject,
} from "@/actions/seo-keyword-research";
import { cn } from "@/lib/utils";

export type KeywordProjectRow = {
  id: string;
  name: string;
  seedKeyword: string;
  status: SeoAnalysisStatus;
  keywordCount: number;
  dataNotice: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export function KeywordResearchClient({
  projects,
}: {
  projects: KeywordProjectRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [seed, setSeed] = useState("");
  const [description, setDescription] = useState("");

  // Auto-refresh selama ada proyek yang masih berproses.
  const hasBusy = projects.some((p) => isSeoStatusBusy(p.status));
  useEffect(() => {
    if (!hasBusy) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [hasBusy, router]);

  function handleCreate() {
    if (!name.trim() || !seed.trim()) {
      toast.error("Nama proyek dan seed keyword wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await createSeoKeywordProject({
          name: name.trim(),
          seedKeyword: seed.trim(),
          description: description.trim() || undefined,
        });
        setName("");
        setSeed("");
        setDescription("");
        toast.success("Proyek dibuat — riset berjalan di background.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat proyek."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSeoKeywordProject(id);
        toast.success("Proyek dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus proyek."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <LabSection
        title="Proyek baru"
        description="Masukkan seed keyword (mis. nama kategori produk). Kami ambil keyword turunan + metrik lalu cluster otomatis."
      >
        <div className={cn(lab.panel, "grid gap-3 sm:grid-cols-2")}>
          <div className="grid gap-1.5">
            <Label>Nama proyek</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Serum Vitamin C"
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Seed keyword</Label>
            <Input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="mis. serum vitamin c"
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Catatan (opsional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Konteks singkat proyek riset ini…"
              disabled={pending}
              rows={2}
            />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={handleCreate} disabled={pending}>
              {pending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Plus />
              )}
              Buat & riset
            </Button>
          </div>
        </div>
      </LabSection>

      <LabSection title="Proyek keyword" description={`${projects.length} proyek.`}>
        {projects.length === 0 ? (
          <LabEmptyState
            icon={Search}
            title="Belum ada proyek"
            description="Buat proyek pertama dengan seed keyword di atas."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className={cn(lab.card, "flex flex-col gap-3 p-4")}
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/seo/keyword-research/${p.id}`}
                    className="min-w-0 flex-1"
                  >
                    <p className="text-foreground truncate font-semibold hover:underline">
                      {p.name}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      seed: {p.seedKeyword}
                    </p>
                  </Link>
                  <SeoStatusBadge status={p.status} />
                </div>

                {p.status === SeoAnalysisStatus.FAILED && p.errorMessage ? (
                  <p className="text-destructive text-xs">{p.errorMessage}</p>
                ) : null}
                {p.dataNotice ? (
                  <p className="text-muted-foreground text-xs">{p.dataNotice}</p>
                ) : null}

                <div className="text-muted-foreground mt-auto flex items-center justify-between text-xs">
                  <span>{p.keywordCount} keyword</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      render={
                        <Link href={`/seo/keyword-research/${p.id}`} />
                      }
                    >
                      Buka
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(p.id)}
                      disabled={pending}
                      aria-label="Hapus proyek"
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </LabSection>
    </div>
  );
}
