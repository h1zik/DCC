"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import { Link2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LabEmptyState,
  LabSection,
  lab,
} from "@/components/lab/lab-primitives";
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import { isSeoStatusBusy } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createSeoBacklinkProfile,
  deleteSeoBacklinkProfile,
} from "@/actions/seo-backlinks";
import { cn } from "@/lib/utils";

export type BacklinkProfileRow = {
  id: string;
  name: string;
  target: string;
  status: SeoAnalysisStatus;
  backlinks: number | null;
  referringDomains: number | null;
  errorMessage: string | null;
  createdAt: string;
};

function num(value: number | null): string {
  return value == null ? "—" : value.toLocaleString("id-ID");
}

export function BacklinksClient({ profiles }: { profiles: BacklinkProfileRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");

  const hasBusy = profiles.some((p) => isSeoStatusBusy(p.status));
  useEffect(() => {
    if (!hasBusy) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [hasBusy, router]);

  function handleCreate() {
    if (!name.trim() || !target.trim()) {
      toast.error("Nama dan target wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await createSeoBacklinkProfile({ name: name.trim(), target: target.trim() });
        setName("");
        setTarget("");
        toast.success("Profil dibuat — analisis berjalan di background.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat profil."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSeoBacklinkProfile(id);
        toast.success("Profil dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <LabSection
        title="Profil baru"
        description="Masukkan domain (atau URL) milikmu untuk menganalisis profil backlink-nya."
      >
        <div className={cn(lab.panel, "grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end")}>
          <div className="grid gap-1.5">
            <Label>Nama</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Brand Anda"
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Domain / URL target</Label>
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="brandanda.com"
              disabled={pending}
            />
          </div>
          <Button onClick={handleCreate} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Plus />}
            Analisis
          </Button>
        </div>
      </LabSection>

      <LabSection title="Profil backlink" description={`${profiles.length} profil.`}>
        {profiles.length === 0 ? (
          <LabEmptyState
            icon={Link2}
            title="Belum ada profil"
            description="Buat profil backlink pertama di atas."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((p) => (
              <div key={p.id} className={cn(lab.card, "flex flex-col gap-2 p-4")}>
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/seo/backlinks/${p.id}`} className="min-w-0 flex-1">
                    <p className="text-foreground truncate font-semibold hover:underline">
                      {p.name}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {p.target}
                    </p>
                  </Link>
                  <SeoStatusBadge status={p.status} />
                </div>
                {p.status === SeoAnalysisStatus.FAILED && p.errorMessage ? (
                  <p className="text-destructive text-xs">{p.errorMessage}</p>
                ) : (
                  <div className="text-muted-foreground flex gap-4 text-xs">
                    <span>{num(p.backlinks)} backlink</span>
                    <span>{num(p.referringDomains)} ref. domain</span>
                  </div>
                )}
                <div className="mt-auto flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(p.id)}
                    disabled={pending}
                    aria-label="Hapus profil"
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </LabSection>
    </div>
  );
}
