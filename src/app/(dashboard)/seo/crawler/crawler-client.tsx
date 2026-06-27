"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoAnalysisStatus } from "@prisma/client";
import { Bug, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  ResearchHubEmptyState,
  ResearchHubSection,
  hub,
} from "@/components/research-hub/research-hub-primitives";
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import { isSeoStatusBusy } from "@/lib/seo/labels";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createSeoSiteCrawl,
  deleteSeoSiteCrawl,
} from "@/actions/seo-crawler";
import { cn } from "@/lib/utils";

export type CrawlRow = {
  id: string;
  name: string;
  domain: string;
  status: SeoAnalysisStatus;
  pagesCrawled: number;
  maxPages: number;
  includeLighthouse: boolean;
  issueCount: number;
  errorMessage: string | null;
  createdAt: string;
};

export function CrawlerClient({ crawls }: { crawls: CrawlRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [maxPages, setMaxPages] = useState("100");
  const [lighthouse, setLighthouse] = useState(false);

  const hasBusy = crawls.some((c) => isSeoStatusBusy(c.status));
  useEffect(() => {
    if (!hasBusy) return;
    const timer = setInterval(() => router.refresh(), 6000);
    return () => clearInterval(timer);
  }, [hasBusy, router]);

  function handleCreate() {
    if (!name.trim() || !domain.trim()) {
      toast.error("Nama dan domain wajib diisi.");
      return;
    }
    const parsedMax = Math.min(1000, Math.max(1, Number(maxPages) || 100));
    startTransition(async () => {
      try {
        await createSeoSiteCrawl({
          name: name.trim(),
          domain: domain.trim(),
          maxPages: parsedMax,
          includeLighthouse: lighthouse,
        });
        setName("");
        setDomain("");
        setMaxPages("100");
        setLighthouse(false);
        toast.success("Crawl dimulai — berjalan di background (cek berkala).");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memulai crawl."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSeoSiteCrawl(id);
        toast.success("Crawl dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <ResearchHubSection
        title="Crawl baru"
        description="Crawl berjalan di DataForSEO (beberapa menit). Halaman akan ter-update saat selesai."
      >
        <div className={cn(hub.panel, "grid gap-3 sm:grid-cols-2")}>
          <div className="grid gap-1.5">
            <Label>Nama</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Audit teknis brandanda.com"
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Domain</Label>
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="brandanda.com"
              disabled={pending}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Maks. halaman</Label>
            <Input
              type="number"
              min={1}
              max={1000}
              value={maxPages}
              onChange={(e) => setMaxPages(e.target.value)}
              disabled={pending}
            />
          </div>
          <label className="flex items-center gap-2 self-end pb-1.5 text-sm">
            <Checkbox
              checked={lighthouse}
              onCheckedChange={(v) => setLighthouse(v === true)}
              disabled={pending}
            />
            Sertakan Core Web Vitals (Lighthouse)
          </label>
          <div className="sm:col-span-2">
            <Button onClick={handleCreate} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Plus />}
              Mulai crawl
            </Button>
          </div>
        </div>
      </ResearchHubSection>

      <ResearchHubSection title="Riwayat crawl" description={`${crawls.length} crawl.`}>
        {crawls.length === 0 ? (
          <ResearchHubEmptyState
            icon={Bug}
            title="Belum ada crawl"
            description="Mulai crawl teknis pertama di atas."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {crawls.map((c) => (
              <div key={c.id} className={cn(hub.card, "flex items-center gap-3 p-3")}>
                <Link href={`/seo/crawler/${c.id}`} className="min-w-0 flex-1">
                  <p className="text-foreground truncate font-medium hover:underline">
                    {c.name}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {c.domain} · {c.pagesCrawled}/{c.maxPages} halaman ·{" "}
                    {c.issueCount} isu
                  </p>
                  {c.status === SeoAnalysisStatus.FAILED && c.errorMessage ? (
                    <p className="text-destructive truncate text-xs">
                      {c.errorMessage}
                    </p>
                  ) : null}
                </Link>
                {c.includeLighthouse ? (
                  <Badge variant="outline" className="hidden sm:inline-flex">
                    CWV
                  </Badge>
                ) : null}
                <SeoStatusBadge status={c.status} />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(c.id)}
                  disabled={pending}
                  aria-label="Hapus crawl"
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
