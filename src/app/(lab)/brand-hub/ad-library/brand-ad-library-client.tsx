"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowUpRight,
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
import { lab, LabEmptyState, LabSection } from "@/components/lab/lab-primitives";
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

/** Pill status scrape tinted: emerald siap, amber berjalan, rose gagal. */
function StatusPill({ status }: { status: SocialListeningStatus | null }) {
  const running = isInProgress(status);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        status === "READY" &&
          "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        status === "FAILED" &&
          "bg-rose-500/15 text-rose-700 dark:text-rose-300",
        running && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        status == null && "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "READY" && "bg-emerald-500",
          status === "FAILED" && "bg-rose-500",
          running && "bg-amber-500 animate-pulse motion-reduce:animate-none",
          status == null && "bg-muted-foreground/50",
        )}
        aria-hidden
      />
      {status ? STATUS_LABEL[status] ?? status : "Belum scrape"}
    </span>
  );
}

function CardStat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
        {label}
      </p>
      <p className="text-foreground mt-0.5 truncate text-sm font-extrabold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
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
  const runningCount = monitors.filter((m) =>
    isInProgress(m.latestStatus),
  ).length;

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
      {/* Strip ringkasan bento */}
      {monitors.length > 0 ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          {/* Hero pink — total iklan */}
          <div className="bento-tile border-transparent bg-pink-600 shadow-md shadow-pink-600/20 dark:bg-pink-500">
            <span className="text-[11.5px] font-semibold text-pink-100 dark:text-pink-950/70">
              Total iklan
            </span>
            <span className="bento-value text-white dark:text-pink-950">
              {totalAds.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium leading-snug text-pink-100/90 dark:text-pink-900/80">
              terkumpul dari {monitors.length} monitor Meta Ad Library
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Monitor</span>
            <span className="bento-value">{monitors.length}</span>
            <span className="text-muted-foreground text-[11px] font-medium">
              keyword & halaman kompetitor
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Siap dianalisis</span>
            <span className="bento-value">{readyCount}</span>
            <span className="text-muted-foreground text-[11px] font-medium">
              scrape terakhir selesai
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
            <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
              Berjalan
            </span>
            <span className="bento-value text-amber-900 dark:text-amber-300">
              {runningCount}
            </span>
            <span className="text-[11px] font-medium text-amber-800/60 dark:text-amber-200/50">
              sedang mengumpulkan iklan
            </span>
          </div>
        </div>
      ) : null}

      <LabSection
        title="Monitor Iklan"
        description="Kumpulkan referensi kreatif dari Meta Ad Library untuk tim branding."
        action={
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
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_12%,transparent)] text-[var(--lab-accent,var(--primary))]">
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

                <div className="bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-relaxed">
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
        }
      >
        {monitors.length === 0 ? (
          <LabEmptyState
            icon={Megaphone}
            title="Belum ada monitor Ad Library"
            description="Buat monitor untuk mengumpulkan iklan Meta kompetitor — hook, CTA, dan format kreatif."
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="size-3.5" aria-hidden />
                Monitor Baru
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {monitors.map((monitor, index) => (
              <div
                key={monitor.id}
                className={cn(lab.card, lab.entrance, "group flex flex-col p-0")}
                style={
                  index > 0 && index < 8
                    ? { animationDelay: `${index * 40}ms` }
                    : undefined
                }
              >
                <Link
                  href={brandHubHref(
                    `/brand-hub/ad-library/${monitor.id}`,
                    brandId,
                  )}
                  className="flex flex-1 flex-col gap-4 p-5 pb-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_12%,transparent)] text-[var(--lab-accent,var(--primary))]"
                        aria-hidden
                      >
                        <Megaphone className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                          <span className="truncate">{monitor.name}</span>
                          <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                        </p>
                        <p className="text-muted-foreground line-clamp-1 text-xs">
                          {monitor.searchTerms.join(", ") ||
                            monitor.adLibraryUrls[0] ||
                            "—"}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={monitor.latestStatus} />
                  </div>

                  {monitor.latestStatus === "FAILED" && monitor.errorMessage ? (
                    <p className="line-clamp-2 text-xs leading-relaxed text-rose-700 dark:text-rose-300">
                      {monitor.errorMessage}
                    </p>
                  ) : null}

                  {monitor.aiSummary ? (
                    <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                      {monitor.aiSummary}
                    </p>
                  ) : null}

                  <div className="grid grid-cols-3 gap-2">
                    <CardStat
                      label="Iklan"
                      value={monitor.adCount.toLocaleString("id-ID")}
                    />
                    <CardStat label="Negara" value={monitor.country} />
                    <CardStat
                      label="Format"
                      value={scrapeMediaTypeLabel(monitor.mediaType)}
                    />
                  </div>

                  {isInProgress(monitor.latestStatus) ? (
                    <JobProgressBar
                      title="Mengumpulkan iklan Meta"
                      percent={35}
                      stepLabel="Scrape Ad Library berjalan..."
                    />
                  ) : null}
                </Link>

                <div className="border-border/60 flex items-center justify-end gap-1 border-t px-3 py-2">
                  <Button
                    size="sm"
                    variant="ghost"
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
                    size="icon-sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={pending}
                    aria-label="Hapus monitor"
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
        )}
      </LabSection>
    </div>
  );
}
