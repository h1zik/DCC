"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoRankDevice } from "@prisma/client";
import { Loader2, LineChart, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { SEO_DEVICE_LABELS } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createSeoRankProject,
  deleteSeoRankProject,
  toggleRankProjectActive,
} from "@/actions/seo-rank-tracker";
import { cn } from "@/lib/utils";

export type RankProjectRow = {
  id: string;
  name: string;
  domain: string;
  device: SeoRankDevice;
  isActive: boolean;
  keywordCount: number;
  createdAt: string;
};

function parseKeywords(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((k) => k.trim())
    .filter(Boolean);
}

export function RankTrackerClient({
  projects,
}: {
  projects: RankProjectRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [device, setDevice] = useState<SeoRankDevice>(SeoRankDevice.MOBILE);
  const [keywords, setKeywords] = useState("");

  function handleCreate() {
    if (!name.trim() || !domain.trim()) {
      toast.error("Nama dan domain wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await createSeoRankProject({
          name: name.trim(),
          domain: domain.trim(),
          device,
          keywords: parseKeywords(keywords),
        });
        setName("");
        setDomain("");
        setKeywords("");
        toast.success("Proyek dibuat — cek posisi awal berjalan di background.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat proyek."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSeoRankProject(id);
        toast.success("Proyek dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  function handleToggle(id: string, next: boolean) {
    startTransition(async () => {
      try {
        await toggleRankProjectActive(id, next);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengubah status."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <ResearchHubSection
        title="Proyek baru"
        description="Masukkan domain target dan keyword yang ingin dilacak posisinya di Google ID."
      >
        <div className={cn(hub.panel, "grid gap-3 sm:grid-cols-2")}>
          <div className="grid gap-1.5">
            <Label>Nama proyek</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Brand Anda – Skincare"
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Domain target</Label>
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="mis. brandanda.com"
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Perangkat</Label>
            <Select
              value={device}
              onValueChange={(v) => {
                if (v) setDevice(v as SeoRankDevice);
              }}
            >
              <SelectTrigger>{SEO_DEVICE_LABELS[device]}</SelectTrigger>
              <SelectContent>
                {Object.values(SeoRankDevice).map((d) => (
                  <SelectItem key={d} value={d}>
                    {SEO_DEVICE_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Keyword (satu per baris)</Label>
            <Textarea
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder={"serum vitamin c\nmoisturizer untuk kulit berminyak"}
              disabled={pending}
              rows={3}
            />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={handleCreate} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Plus />}
              Buat proyek
            </Button>
          </div>
        </div>
      </ResearchHubSection>

      <ResearchHubSection
        title="Proyek rank tracking"
        description={`${projects.length} proyek.`}
      >
        {projects.length === 0 ? (
          <ResearchHubEmptyState
            icon={LineChart}
            title="Belum ada proyek"
            description="Buat proyek rank tracking pertama di atas."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <div key={p.id} className={cn(hub.card, "flex flex-col gap-3 p-4")}>
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/seo/rank-tracker/${p.id}`}
                    className="min-w-0 flex-1"
                  >
                    <p className="text-foreground truncate font-semibold hover:underline">
                      {p.name}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {p.domain}
                    </p>
                  </Link>
                  <Badge variant={p.isActive ? "secondary" : "outline"}>
                    {p.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </div>

                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Badge variant="outline">{SEO_DEVICE_LABELS[p.device]}</Badge>
                  <span>{p.keywordCount} keyword</span>
                </div>

                <div className="mt-auto flex items-center justify-between gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggle(p.id, !p.isActive)}
                    disabled={pending}
                  >
                    {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      render={<Link href={`/seo/rank-tracker/${p.id}`} />}
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
      </ResearchHubSection>
    </div>
  );
}
