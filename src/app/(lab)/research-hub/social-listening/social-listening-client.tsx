"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  ArrowUpRight,
  MessageSquare,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SOCIAL_LISTENING_PLATFORM_LABELS,
  SOCIAL_LISTENING_STATUS_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
import { lab, LabEmptyState, LabSection } from "@/components/lab/lab-primitives";
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

/** Pill status sync tinted: emerald siap, amber berjalan, rose gagal. */
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
      {status ? SOCIAL_LISTENING_STATUS_LABELS[status] : "Belum sync"}
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

export function SocialListeningClient({
  monitors,
}: {
  monitors: SocialMonitorRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(monitors.length === 0);
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
  const inProgressCount = monitors.filter((m) =>
    isInProgress(m.latestStatus),
  ).length;
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
        setFormOpen(false);
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
      {/* Strip ringkasan bento */}
      {monitors.length > 0 ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          <div className="bento-tile border-transparent bg-violet-600 shadow-md shadow-violet-600/20 dark:bg-violet-500">
            <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
              Total mention
            </span>
            <span className="bento-value text-white dark:text-violet-950">
              {totalMentions.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium text-violet-100/90 dark:text-violet-900/80">
              dari sync terakhir {monitors.length} monitor
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Monitor aktif</span>
            <span className="bento-value">
              {activeCount}
              <span className="text-muted-foreground/60 text-lg font-bold">
                {" "}
                / {monitors.length}
              </span>
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              ikut sync terjadwal
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Siap dianalisis</span>
            <span className="bento-value">{readyCount}</span>
            <span className="text-muted-foreground text-[11px] font-medium">
              sync terakhir selesai
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
            <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
              Berjalan
            </span>
            <span className="bento-value text-amber-900 dark:text-amber-300">
              {inProgressCount}
            </span>
            <span className="text-[11px] font-medium text-amber-800/60 dark:text-amber-200/50">
              sedang mengumpulkan mention
            </span>
          </div>
        </div>
      ) : null}

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
        description={
          monitors.length === 0
            ? "Mulai dengan monitor pertama Anda di bawah."
            : `${monitors.length} monitor · ${totalMentions.toLocaleString("id-ID")} mention terkumpul dari TikTok & Instagram.`
        }
        action={
          monitors.length > 0 ? (
            <Button
              variant={formOpen ? "outline" : "default"}
              onClick={() => setFormOpen((v) => !v)}
            >
              {formOpen ? <X /> : <Plus />}
              {formOpen ? "Tutup" : "Monitor baru"}
            </Button>
          ) : null
        }
      >
        {/* Form monitor baru (collapsible) */}
        {formOpen ? (
          <div
            className={cn(
              lab.panel,
              "grid gap-4",
              "animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none",
            )}
          >
            <div>
              <p className="text-foreground font-bold tracking-tight">
                Monitor baru
              </p>
              <p className="text-muted-foreground text-sm">
                Masukkan keyword yang ingin dipantau percakapannya di TikTok
                dan Instagram.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="sl-name">Nama monitor</Label>
                <Input
                  id="sl-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Body care trending"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sl-keywords">Keywords (pisahkan koma)</Label>
                <Input
                  id="sl-keywords"
                  value={keywordsText}
                  onChange={(e) => setKeywordsText(e.target.value)}
                  placeholder="body lotion, sunscreen kulit gelap"
                  disabled={pending}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
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
            <div className="grid gap-3 sm:grid-cols-2">
              {platforms.includes(SocialListeningPlatform.TIKTOK) ? (
                <div className="grid gap-1.5">
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
                    disabled={pending}
                  />
                  <p className="text-muted-foreground text-xs">
                    Maks {MAX_TIKTOK_SEARCH_LIMIT} video per keyword.
                  </p>
                </div>
              ) : null}
              {platforms.includes(SocialListeningPlatform.INSTAGRAM) ? (
                <div className="grid gap-1.5">
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
                    disabled={pending}
                  />
                  <p className="text-muted-foreground text-xs">
                    Maks {MAX_INSTAGRAM_SEARCH_LIMIT} post per hashtag.
                  </p>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">
                Mention dikumpulkan lalu diklasifikasi AI — pain points,
                wishlist, influencer, dan konten viral.
              </p>
              <Button onClick={handleCreate} disabled={pending || !name.trim()}>
                <Plus />
                {pending ? "Memproses…" : "Buat Monitor"}
              </Button>
            </div>
          </div>
        ) : null}

        {monitors.length === 0 ? (
          !formOpen ? (
            <LabEmptyState
              icon={MessageSquare}
              title="Belum ada monitor"
              description="Tambahkan keyword untuk mulai listening — sistem akan mengumpulkan mention, pain points, wishlist, dan konten viral."
              action={
                <Button size="sm" onClick={() => setFormOpen(true)}>
                  <Plus className="size-3.5" aria-hidden />
                  Tambah Monitor
                </Button>
              }
            />
          ) : null
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {monitors.map((m) => (
              <div
                key={m.id}
                className={cn(
                  lab.card,
                  "group flex flex-col p-0",
                  !m.isActive && "opacity-80",
                )}
              >
                <Link
                  href={`/research-hub/social-listening/${m.id}`}
                  className="flex flex-1 flex-col gap-4 p-5 pb-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-extrabold uppercase"
                        aria-hidden
                      >
                        {m.name.trim().charAt(0) || "?"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                          <span className="truncate">{m.name}</span>
                          <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                        </p>
                        <p className="text-muted-foreground line-clamp-1 text-xs">
                          {m.keywords.join(", ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusPill status={m.latestStatus} />
                      {!m.isActive ? (
                        <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase">
                          Nonaktif
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {m.latestStatus === "FAILED" && m.errorMessage ? (
                    <p className="line-clamp-2 text-xs leading-relaxed text-rose-700 dark:text-rose-300">
                      {m.errorMessage}
                    </p>
                  ) : null}

                  <div className="grid grid-cols-3 gap-2">
                    <CardStat
                      label="Mention"
                      value={m.mentionCount.toLocaleString("id-ID")}
                    />
                    <CardStat
                      label="Keyword"
                      value={m.keywords.length.toLocaleString("id-ID")}
                    />
                    <CardStat
                      label="Sync"
                      value={formatRelativeTime(
                        m.collectedAt ? new Date(m.collectedAt) : null,
                      )}
                    />
                  </div>
                </Link>

                <div className="border-border/60 flex items-center justify-between gap-2 border-t px-3 py-2">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 truncate text-xs">
                    <MessageSquare className="size-3.5 shrink-0" aria-hidden />
                    {m.platforms
                      .map((p) => SOCIAL_LISTENING_PLATFORM_LABELS[p])
                      .join(" · ")}
                  </span>
                  <div className="flex items-center gap-1">
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
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={pending}
                      aria-label="Hapus monitor"
                      onClick={() => handleDelete(m.id)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
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
