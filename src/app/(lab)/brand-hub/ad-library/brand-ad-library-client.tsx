"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Globe,
  Info,
  Link2,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  Target,
  Trash2,
} from "lucide-react";
import { SocialListeningStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  createBrandAdLibraryMonitor,
  deleteBrandAdLibraryMonitor,
  refreshBrandAdLibraryMonitor,
} from "@/actions/brand-meta-ads";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import {
  lab,
  LabEmptyState,
  LabSection,
  LabStatChip,
} from "@/components/lab/lab-primitives";
import { brandHubHref, useBrandHubBrandId } from "@/hooks/use-brand-hub-brand-id";
import { useBrandJobProgress } from "../use-brand-job-progress";
import { cn } from "@/lib/utils";
import { scrapeMediaTypeLabel } from "@/lib/brand-research/ad-library-media";

export type AdLibraryMonitorRow = {
  id: string;
  name: string;
  searchTerms: string[];
  adLibraryUrls: string[];
  country: string;
  mediaType: string;
  adCount: number;
  latestStatus: SocialListeningStatus | null;
  errorMessage: string | null;
  collectedAt: string | null;
  aiSummary: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu",
  COLLECTING: "Mengumpulkan",
  ANALYZING: "Menganalisis",
  READY: "Siap",
  FAILED: "Gagal",
};

function isInProgress(status: SocialListeningStatus | null) {
  return (
    status === "COLLECTING" ||
    status === "ANALYZING" ||
    status === "PENDING"
  );
}

export function BrandAdLibraryClient({
  monitors,
}: {
  monitors: AdLibraryMonitorRow[];
}) {
  const router = useRouter();
  const brandId = useBrandHubBrandId();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [searchTermsText, setSearchTermsText] = useState("");
  const [urlsText, setUrlsText] = useState("");
  const [country, setCountry] = useState("ID");
  const [maxAds, setMaxAds] = useState(50);

  const hasInProgress = monitors.some((m) => isInProgress(m.latestStatus));
  const totalAds = monitors.reduce((sum, m) => sum + m.adCount, 0);
  const readyCount = monitors.filter((m) => m.latestStatus === "READY").length;

  useBrandJobProgress({ inProgress: hasInProgress });

  function handleCreate() {
    const searchTerms = searchTermsText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const adLibraryUrls = urlsText
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    startTransition(async () => {
      try {
        const result = await createBrandAdLibraryMonitor({
          name,
          searchTerms,
          adLibraryUrls,
          country,
          // Default tetap: pencarian luas (semua kata) & gabung Image + Video.
          searchType: "keyword_unordered",
          mediaType: "all",
          maxAds: Math.min(Math.max(Math.round(maxAds) || 50, 10), 200),
          ownerBrandId: brandId,
        });
        toast.success("Monitor Ad Library dibuat.");
        setDialogOpen(false);
        setName("");
        setSearchTermsText("");
        setUrlsText("");
        router.push(
          brandHubHref(`/brand-hub/ad-library/${result.id}`, brandId),
        );
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat monitor."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <LabStatChip
            label="Monitor"
            value={monitors.length.toLocaleString("id-ID")}
            tone="accent"
          />
          <LabStatChip
            label="Siap"
            value={readyCount.toLocaleString("id-ID")}
            tone="success"
          />
          <LabStatChip label="Total iklan" value={totalAds.toLocaleString("id-ID")} />
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button size="sm" className="gap-1.5">
                <Plus className="size-4" />
                Monitor Baru
              </Button>
            }
          />
          <DialogContent className="max-w-lg">
            <DialogHeader className="gap-3">
              <div className="flex items-start gap-3">
                <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <Megaphone className="size-5" />
                </span>
                <div className="flex flex-col gap-1">
                  <DialogTitle>Monitor Meta Ad Library</DialogTitle>
                  <DialogDescription>
                    Kumpulkan iklan aktif kompetitor dari Meta Ad Library lewat
                    keyword atau URL halaman.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto py-1">
              <div className="grid gap-1.5">
                <Label htmlFor="ad-name">Nama monitor</Label>
                <Input
                  id="ad-name"
                  placeholder="Mis. Kompetitor Skincare ID"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="ad-keywords" className="flex items-center gap-1.5">
                  <Search className="text-muted-foreground size-3.5" />
                  Keyword
                </Label>
                <Textarea
                  id="ad-keywords"
                  placeholder="parfum&#10;body mist&#10;eau de parfum"
                  value={searchTermsText}
                  onChange={(e) => setSearchTermsText(e.target.value)}
                  rows={3}
                />
                <p className="text-muted-foreground text-xs">
                  Pisahkan dengan koma atau baris baru. Kosongkan jika memakai URL.
                </p>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="ad-urls" className="flex items-center gap-1.5">
                  <Link2 className="text-muted-foreground size-3.5" />
                  URL Ad Library / Page
                  <span className="text-muted-foreground font-normal">(opsional)</span>
                </Label>
                <Textarea
                  id="ad-urls"
                  placeholder="https://www.facebook.com/ads/library/..."
                  value={urlsText}
                  onChange={(e) => setUrlsText(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="ad-country" className="flex items-center gap-1.5">
                    <Globe className="text-muted-foreground size-3.5" />
                    Negara
                  </Label>
                  <Input
                    id="ad-country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value.toUpperCase())}
                    maxLength={3}
                    placeholder="ID"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ad-max" className="flex items-center gap-1.5">
                    <Target className="text-muted-foreground size-3.5" />
                    Target iklan
                  </Label>
                  <Input
                    id="ad-max"
                    type="number"
                    min={10}
                    max={200}
                    value={maxAds}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setMaxAds(Number.isFinite(n) ? n : 50);
                    }}
                  />
                </div>
              </div>

              <div className="bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-lg px-3 py-2 text-xs leading-relaxed">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Mengumpulkan <strong className="text-foreground">Image &amp; Video</strong>{" "}
                  dengan pencocokan keyword luas. Konten dewasa &amp; judi difilter
                  berdasarkan teks/URL/kategori halaman saja — gambar &amp; video tidak
                  dipindai, jadi materi sensitif bisa lolos.
                </span>
              </div>
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline">Batal</Button>} />
              <Button
                onClick={handleCreate}
                disabled={
                  pending ||
                  !name.trim() ||
                  (!searchTermsText.trim() && !urlsText.trim())
                }
              >
                {pending ? "Memproses…" : "Buat & Scrape"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {monitors.length === 0 ? (
        <LabEmptyState
          icon={Megaphone}
          title="Belum ada monitor Ad Library"
          description="Buat monitor untuk mengumpulkan iklan Meta kompetitor — hook, CTA, dan format kreatif."
        />
      ) : (
        <LabSection
          title="Monitor iklan"
          description="Kumpulkan referensi kreatif dari Meta Ad Library untuk tim branding."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {monitors.map((monitor) => (
              <div
                key={monitor.id}
                className={cn(
                  lab.panel,
                  "flex flex-col gap-3 p-4 transition-colors hover:border-[color-mix(in_srgb,var(--lab-accent,var(--primary))_30%,var(--border))]",
                )}
              >
                <Link
                  href={brandHubHref(
                    `/brand-hub/ad-library/${monitor.id}`,
                    brandId,
                  )}
                  className="min-w-0 flex-1"
                >
                  <h3 className="font-semibold leading-snug hover:text-primary">
                    {monitor.name}
                  </h3>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                    {monitor.searchTerms.join(", ") ||
                      monitor.adLibraryUrls[0] ||
                      "—"}
                  </p>
                  {monitor.aiSummary ? (
                    <p className="text-muted-foreground mt-2 line-clamp-2 text-xs">
                      {monitor.aiSummary}
                    </p>
                  ) : null}
                </Link>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="bg-muted rounded-full px-2 py-0.5 tabular-nums">
                    {monitor.adCount} iklan
                  </span>
                  <span className="bg-muted rounded-full px-2 py-0.5">
                    {monitor.country}
                  </span>
                  <span className="bg-muted rounded-full px-2 py-0.5">
                    {scrapeMediaTypeLabel(monitor.mediaType)}
                  </span>
                  {monitor.latestStatus ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5",
                        monitor.latestStatus === "READY"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : monitor.latestStatus === "FAILED"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                      )}
                    >
                      {STATUS_LABEL[monitor.latestStatus] ?? monitor.latestStatus}
                    </span>
                  ) : null}
                </div>

                {isInProgress(monitor.latestStatus) ? (
                  <JobProgressBar
                    title="Mengumpulkan iklan Meta"
                    percent={35}
                    stepLabel="Scrape Ad Library berjalan..."
                  />
                ) : null}

                <div className="mt-auto flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={pending || isInProgress(monitor.latestStatus)}
                    onClick={() =>
                      startTransition(async () => {
                        try {
                          await refreshBrandAdLibraryMonitor(monitor.id);
                          toast.success("Refresh dijadwalkan.");
                          router.refresh();
                        } catch (err) {
                          toast.error(
                            actionErrorMessage(err, "Gagal refresh."),
                          );
                        }
                      })
                    }
                  >
                    <RefreshCw className="size-3.5" />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive gap-1"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        if (
                          !confirm(`Hapus monitor "${monitor.name}" dan semua iklannya?`)
                        ) {
                          return;
                        }
                        try {
                          await deleteBrandAdLibraryMonitor(monitor.id);
                          toast.success("Monitor dihapus.");
                          router.refresh();
                        } catch (err) {
                          toast.error(
                            actionErrorMessage(err, "Gagal menghapus."),
                          );
                        }
                      })
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </LabSection>
      )}
    </div>
  );
}
