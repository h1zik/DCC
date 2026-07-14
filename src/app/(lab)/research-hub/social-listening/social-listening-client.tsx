"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { MessageSquare, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  SocialListeningPlatform,
  SocialListeningStatus,
} from "@prisma/client";
import { toast } from "sonner";
import {
  createSocialListeningMonitor,
  deleteSocialListeningMonitor,
  refreshSocialListeningMonitor,
  toggleSocialListeningMonitorActive,
} from "@/actions/research-social-listening";
import { actionErrorMessage } from "@/lib/action-error-message";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SOCIAL_LISTENING_PLATFORM_LABELS,
  SOCIAL_LISTENING_STATUS_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
import {
  lab,
  LabEmptyState,
  LabSection,
  LabStatChip,
} from "@/components/lab/lab-primitives";
import {
  DEFAULT_INSTAGRAM_SEARCH_LIMIT,
  DEFAULT_TIKTOK_SEARCH_LIMIT,
  MAX_INSTAGRAM_SEARCH_LIMIT,
  MAX_TIKTOK_SEARCH_LIMIT,
  parseSearchLimitInput,
} from "@/lib/research/social-listening/search-limits-public";
import { cn } from "@/lib/utils";

export type SocialMonitorRow = {
  id: string;
  name: string;
  keywords: string[];
  platforms: SocialListeningPlatform[];
  isActive: boolean;
  latestStatus: SocialListeningStatus | null;
  mentionCount: number;
  collectedAt: string | null;
  errorMessage: string | null;
};

function statusChipTone(
  status: SocialListeningStatus | null,
): "neutral" | "success" | "warning" | "primary" {
  switch (status) {
    case "READY":
      return "success";
    case "FAILED":
      return "warning";
    case "COLLECTING":
    case "ANALYZING":
    case "PENDING":
      return "warning";
    default:
      return "neutral";
  }
}

function isInProgress(status: SocialListeningStatus | null) {
  return (
    status === "COLLECTING" ||
    status === "ANALYZING" ||
    status === "PENDING"
  );
}

const ALL_PLATFORMS: SocialListeningPlatform[] = [
  SocialListeningPlatform.TIKTOK,
  SocialListeningPlatform.INSTAGRAM,
];

export function SocialListeningClient({
  monitors,
}: {
  monitors: SocialMonitorRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [platforms, setPlatforms] = useState<SocialListeningPlatform[]>([
    SocialListeningPlatform.TIKTOK,
    SocialListeningPlatform.INSTAGRAM,
  ]);
  const [tiktokLimit, setTiktokLimit] = useState(
    String(DEFAULT_TIKTOK_SEARCH_LIMIT),
  );
  const [instagramLimit, setInstagramLimit] = useState(
    String(DEFAULT_INSTAGRAM_SEARCH_LIMIT),
  );

  const hasInProgress = monitors.some((m) => isInProgress(m.latestStatus));
  const readyCount = monitors.filter((m) => m.latestStatus === "READY").length;
  const activeCount = monitors.filter((m) => m.isActive).length;
  const totalMentions = monitors.reduce((sum, m) => sum + m.mentionCount, 0);

  useEffect(() => {
    if (!hasInProgress) return;
    const id = window.setInterval(() => router.refresh(), 12_000);
    return () => window.clearInterval(id);
  }, [hasInProgress, router]);

  function togglePlatform(platform: SocialListeningPlatform) {
    setPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform],
    );
  }

  function handleCreate() {
    const keywords = keywordsText
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    if (keywords.length === 0) {
      toast.error("Masukkan minimal satu keyword.");
      return;
    }
    if (platforms.length === 0) {
      toast.error("Pilih minimal satu platform.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createSocialListeningMonitor({
          name,
          keywords,
          platforms,
          tiktokSearchLimit: platforms.includes(SocialListeningPlatform.TIKTOK)
            ? parseSearchLimitInput(
                tiktokLimit,
                DEFAULT_TIKTOK_SEARCH_LIMIT,
                MAX_TIKTOK_SEARCH_LIMIT,
              )
            : DEFAULT_TIKTOK_SEARCH_LIMIT,
          instagramSearchLimit: platforms.includes(
            SocialListeningPlatform.INSTAGRAM,
          )
            ? parseSearchLimitInput(
                instagramLimit,
                DEFAULT_INSTAGRAM_SEARCH_LIMIT,
                MAX_INSTAGRAM_SEARCH_LIMIT,
              )
            : DEFAULT_INSTAGRAM_SEARCH_LIMIT,
        });
        toast.success("Monitor dibuat. Jalankan refresh untuk mulai sync.");
        setDialogOpen(false);
        setName("");
        setKeywordsText("");
        router.push(`/research-hub/social-listening/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat monitor."));
      }
    });
  }

  function handleRefresh(id: string) {
    startTransition(async () => {
      try {
        await refreshSocialListeningMonitor(id);
        toast.success("Sync social listening dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh monitor."));
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Hapus monitor ini?")) return;
    startTransition(async () => {
      try {
        await deleteSocialListeningMonitor(id);
        toast.success("Monitor dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus monitor."));
      }
    });
  }

  function handleToggleActive(id: string, isActive: boolean) {
    startTransition(async () => {
      try {
        await toggleSocialListeningMonitorActive(id, isActive);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengubah status monitor."));
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
            label="Aktif"
            value={activeCount.toLocaleString("id-ID")}
            tone="success"
          />
          <LabStatChip
            label="Siap"
            value={readyCount.toLocaleString("id-ID")}
          />
          <LabStatChip
            label="Total mention"
            value={totalMentions.toLocaleString("id-ID")}
          />
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="mr-1.5 size-3.5" aria-hidden />
                Tambah Monitor
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Monitor Social Listening Baru</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="sl-name">Nama monitor</Label>
                <Input
                  id="sl-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Body care trending"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sl-keywords">Keywords (pisahkan koma)</Label>
                <Input
                  id="sl-keywords"
                  value={keywordsText}
                  onChange={(e) => setKeywordsText(e.target.value)}
                  placeholder="body lotion, sunscreen kulit gelap"
                />
              </div>
              <div className="space-y-2">
                <Label>Platform</Label>
                <div className="flex flex-wrap gap-4">
                  {ALL_PLATFORMS.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={platforms.includes(p)}
                        onCheckedChange={() => togglePlatform(p)}
                      />
                      {SOCIAL_LISTENING_PLATFORM_LABELS[p]}
                    </label>
                  ))}
                </div>
              </div>
              {platforms.includes(SocialListeningPlatform.TIKTOK) ? (
                <div className="space-y-2">
                  <Label htmlFor="sl-tiktok-limit">
                    Limit video TikTok per keyword
                  </Label>
                  <Input
                    id="sl-tiktok-limit"
                    type="number"
                    min={1}
                    max={MAX_TIKTOK_SEARCH_LIMIT}
                    value={tiktokLimit}
                    onChange={(e) => setTiktokLimit(e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">
                    Maks {MAX_TIKTOK_SEARCH_LIMIT} video per keyword.
                  </p>
                </div>
              ) : null}
              {platforms.includes(SocialListeningPlatform.INSTAGRAM) ? (
                <div className="space-y-2">
                  <Label htmlFor="sl-instagram-limit">
                    Limit post Instagram per hashtag
                  </Label>
                  <Input
                    id="sl-instagram-limit"
                    type="number"
                    min={1}
                    max={MAX_INSTAGRAM_SEARCH_LIMIT}
                    value={instagramLimit}
                    onChange={(e) => setInstagramLimit(e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">
                    Maks {MAX_INSTAGRAM_SEARCH_LIMIT} post per hashtag.
                  </p>
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={pending || !name.trim()}>
                Buat Monitor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {hasInProgress ? (
        <div className={lab.entrance}>
          <JobProgressBar
            title="Sync social listening berjalan"
            percent={40}
            stepLabel="Satu atau lebih monitor sedang mengumpulkan mention dari TikTok & Instagram."
          />
          <p className="text-muted-foreground mt-1.5 px-1 text-xs">
            Halaman diperbarui otomatis setiap beberapa detik.
          </p>
        </div>
      ) : null}

      <LabSection
        title="Monitor Social Listening"
        description="Pantau percakapan organik TikTok & Instagram berdasarkan keyword."
      >
        {monitors.length === 0 ? (
          <LabEmptyState
            icon={MessageSquare}
            title="Belum ada monitor"
            description="Tambahkan keyword untuk mulai listening — sistem akan mengumpulkan mention, pain points, wishlist, dan konten viral."
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="size-3.5" aria-hidden />
                Tambah Monitor
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {monitors.map((m, index) => (
              <div
                key={m.id}
                className={cn(
                  lab.panel,
                  lab.cardHover,
                  lab.entrance,
                  !m.isActive && "opacity-80",
                )}
                style={
                  index > 0 && index < 8
                    ? { animationDelay: `${index * 40}ms` }
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/research-hub/social-listening/${m.id}`}
                      className="hover:text-primary text-base font-semibold transition-colors duration-150 motion-reduce:transition-none"
                    >
                      {m.name}
                    </Link>
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                      {m.keywords.join(", ")}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {m.platforms
                        .map((p) => SOCIAL_LISTENING_PLATFORM_LABELS[p])
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <LabStatChip
                      label="Status"
                      value={
                        m.latestStatus
                          ? SOCIAL_LISTENING_STATUS_LABELS[m.latestStatus]
                          : "Belum sync"
                      }
                      tone={statusChipTone(m.latestStatus)}
                    />
                    {!m.isActive ? (
                      <span className="text-muted-foreground text-[10px] font-medium uppercase">
                        Nonaktif
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <LabStatChip
                    label="Mention"
                    value={m.mentionCount.toLocaleString("id-ID")}
                    tone="accent"
                  />
                  <LabStatChip
                    label="Keyword"
                    value={m.keywords.length.toLocaleString("id-ID")}
                  />
                  <LabStatChip
                    label="Sync"
                    value={formatRelativeTime(
                      m.collectedAt ? new Date(m.collectedAt) : null,
                    )}
                  />
                </div>

                <div className="mt-3 flex gap-1 border-t border-border/40 pt-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending || isInProgress(m.latestStatus)}
                    onClick={() => handleRefresh(m.id)}
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => handleToggleActive(m.id, !m.isActive)}
                  >
                    {m.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={pending}
                    onClick={() => handleDelete(m.id)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Hapus
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
