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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SOCIAL_LISTENING_PLATFORM_LABELS,
  SOCIAL_LISTENING_STATUS_LABELS,
} from "@/lib/research/labels";
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

function statusTone(status: SocialListeningStatus | null) {
  switch (status) {
    case "READY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "FAILED":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "COLLECTING":
    case "ANALYZING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground";
  }
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

  const hasInProgress = monitors.some(
    (m) =>
      m.latestStatus === "COLLECTING" ||
      m.latestStatus === "ANALYZING" ||
      m.latestStatus === "PENDING",
  );

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Pantau percakapan organik TikTok & Instagram berdasarkan keyword.
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="mr-1.5 size-4" />
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
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={pending || !name.trim()}>
                Buat Monitor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border-border/60 overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Monitor</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Mentions</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monitors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                  <MessageSquare className="mx-auto mb-2 size-8 opacity-40" />
                  Belum ada monitor. Tambahkan keyword untuk mulai listening.
                </TableCell>
              </TableRow>
            ) : (
              monitors.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Link
                      href={`/research-hub/social-listening/${m.id}`}
                      className="font-medium hover:underline"
                    >
                      {m.name}
                    </Link>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {m.keywords.join(", ")}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs">
                    {m.platforms
                      .map((p) => SOCIAL_LISTENING_PLATFORM_LABELS[p])
                      .join(", ")}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        statusTone(m.latestStatus),
                      )}
                    >
                      {m.latestStatus
                        ? SOCIAL_LISTENING_STATUS_LABELS[m.latestStatus]
                        : "Belum sync"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.mentionCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        disabled={pending}
                        onClick={() => handleRefresh(m.id)}
                        title="Refresh"
                      >
                        <RefreshCw className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        disabled={pending}
                        onClick={() => handleToggleActive(m.id, !m.isActive)}
                      >
                        {m.isActive ? "Nonaktif" : "Aktif"}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-rose-600"
                        disabled={pending}
                        onClick={() => handleDelete(m.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
