"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { MessageSquare, Pause, Play, Plus, RefreshCw, Trash2, X } from "lucide-react";
import {
  SocialListeningPlatform,
  SocialListeningStatus,
} from "@prisma/client";
import { toast } from "sonner";
import {
  deleteSocialListeningMonitor,
  refreshSocialListeningMonitor,
  toggleSocialListeningMonitorActive,
} from "@/actions/research-social-listening";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  SOCIAL_LISTENING_PLATFORM_LABELS,
  SOCIAL_LISTENING_STATUS_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
import { LabEmptyState } from "@/components/lab/lab-primitives";
import { RunLedger, countRunTones } from "@/components/research-hub/kit/run-ledger";
import { RunStatusBadge, type RunTone } from "@/components/research-hub/kit/run-status";
import {
  ResearchFilterBar,
  filterRuns,
  type RunToneFilter,
} from "@/components/research-hub/kit/research-filter-bar";
import {
  ResearchTable,
  SortableHead,
  useSortedRows,
} from "@/components/research-hub/kit/research-table";
import { SocialMonitorForm } from "./social-monitor-form";
import { ResearchFilterEmpty } from "@/components/research-hub/kit/research-section";

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
  return status === "COLLECTING" || status === "ANALYZING" || status === "PENDING";
}

function toneOf(status: SocialListeningStatus | null): RunTone {
  if (status === "READY") return "ready";
  if (status === "FAILED") return "failed";
  if (isInProgress(status)) return "running";
  return "idle";
}

const LEDGER_LABELS = { running: "Sync berjalan", idle: "Belum sync" } as const;

function platformText(platforms: SocialListeningPlatform[]) {
  return platforms.map((p) => SOCIAL_LISTENING_PLATFORM_LABELS[p]).join(", ");
}

export function SocialListeningClient({
  monitors,
}: {
  monitors: SocialMonitorRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(monitors.length === 0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RunToneFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<SocialMonitorRow | null>(null);

  const hasInProgress = monitors.some((m) => isInProgress(m.latestStatus));
  const activeCount = monitors.filter((m) => m.isActive).length;
  const totalMentions = monitors.reduce((sum, m) => sum + m.mentionCount, 0);
  const counts = useMemo(
    () => countRunTones(monitors, (m) => toneOf(m.latestStatus)),
    [monitors],
  );

  useEffect(() => {
    if (!hasInProgress) return;
    const id = window.setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 12_000);
    return () => window.clearInterval(id);
  }, [hasInProgress, router]);

  const filtered = useMemo(
    () =>
      filterRuns(monitors, {
        search,
        status,
        text: (m) => `${m.name} ${m.keywords.join(" ")} ${platformText(m.platforms)}`,
        tone: (m) => toneOf(m.latestStatus),
      }),
    [monitors, search, status],
  );

  const { sorted, sort, toggle } = useSortedRows(filtered, {
    name: (m) => m.name,
    mentions: (m) => m.mentionCount,
    synced: (m) => m.collectedAt ?? "",
  });

  function handleRefresh(m: SocialMonitorRow) {
    startTransition(async () => {
      try {
        await refreshSocialListeningMonitor(m.id);
        toast.success(`Sync "${m.name}" dimulai.`);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Sync gagal dimulai. Coba lagi sebentar lagi."));
      }
    });
  }

  function handleDelete() {
    const target = deleteTarget;
    if (!target) return;
    startTransition(async () => {
      try {
        await deleteSocialListeningMonitor(target.id);
        toast.success(`Monitor "${target.name}" dihapus.`);
        setDeleteTarget(null);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Monitor gagal dihapus."));
      }
    });
  }

  function handleToggleActive(m: SocialMonitorRow) {
    const next = !m.isActive;
    startTransition(async () => {
      try {
        await toggleSocialListeningMonitorActive(m.id, next);
        toast.success(`"${m.name}" ${next ? "diaktifkan" : "dinonaktifkan"}.`);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Status monitor gagal diubah."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {monitors.length > 0 ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
          <RunLedger
            className="flex-1"
            counts={counts}
            noun="monitor"
            labels={LEDGER_LABELS}
            detail={`${totalMentions.toLocaleString("id-ID")} mention dari sync terakhir, ${activeCount} monitor aktif`}
          />
          <Button
            variant={formOpen ? "outline" : "default"}
            onClick={() => setFormOpen((v) => !v)}
            aria-expanded={formOpen}
            aria-controls="sl-form"
          >
            {formOpen ? <X aria-hidden /> : <Plus aria-hidden />}
            {formOpen ? "Tutup form" : "Monitor baru"}
          </Button>
        </div>
      ) : null}

      {hasInProgress ? (
        <p className="rh-meta" aria-live="polite">
          Ada monitor yang masih mengumpulkan mention. Halaman ini diperbarui
          otomatis setiap beberapa detik.
        </p>
      ) : null}

      {formOpen ? (
        <SocialMonitorForm
          id="sl-form"
          onCancel={monitors.length > 0 ? () => setFormOpen(false) : undefined}
        />
      ) : null}

      {monitors.length === 0 && !formOpen ? (
        <LabEmptyState
          icon={MessageSquare}
          title="Belum ada monitor"
          description="Buat monitor dari beberapa keyword untuk mengumpulkan mention, pain point, wishlist, dan konten viral dari TikTok dan Instagram."
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-3.5" aria-hidden />
              Monitor baru
            </Button>
          }
        />
      ) : null}

      {monitors.length > 0 ? (
        <section aria-label="Daftar monitor" className="flex flex-col gap-3">
          <ResearchFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Cari monitor atau keyword…"
            status={status}
            onStatusChange={setStatus}
            statusCounts={counts}
            statusLabels={LEDGER_LABELS}
            resultCount={filtered.length}
            totalCount={monitors.length}
            onReset={() => {
              setSearch("");
              setStatus("all");
            }}
          />

          {sorted.length === 0 ? (
            <ResearchFilterEmpty>Tidak ada monitor yang cocok dengan filter ini.</ResearchFilterEmpty>
          ) : (
            <ResearchTable maxHeight="70vh">
              <TableHeader sticky>
                <TableRow>
                  <SortableHead sortKey="name" sort={sort} onSort={toggle}>
                    Monitor
                  </SortableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Status</TableHead>
                  <SortableHead sortKey="mentions" sort={sort} onSort={toggle} align="right">
                    Mention
                  </SortableHead>
                  <SortableHead sortKey="synced" sort={sort} onSort={toggle}>
                    Sync terakhir
                  </SortableHead>
                  <TableHead className="w-0 text-right">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((m) => {
                  const tone = toneOf(m.latestStatus);
                  const running = isInProgress(m.latestStatus);
                  return (
                    <TableRow key={m.id} className="group">
                      <TableCell className="max-w-[24rem] whitespace-normal">
                        <Link
                          href={`/research-hub/social-listening/${m.id}`}
                          className="text-foreground focus-visible:ring-ring rounded font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        >
                          {m.name}
                        </Link>
                        <p className="rh-meta mt-0.5 line-clamp-1">{m.keywords.join(", ")}</p>
                        {tone === "failed" && m.errorMessage ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-rose-700 dark:text-rose-300">
                            {m.errorMessage}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {platformText(m.platforms)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-0.5">
                          <RunStatusBadge
                            tone={tone}
                            label={
                              m.latestStatus
                                ? SOCIAL_LISTENING_STATUS_LABELS[m.latestStatus]
                                : "Belum sync"
                            }
                          />
                          {!m.isActive ? <span className="rh-meta">Nonaktif</span> : null}
                        </div>
                      </TableCell>
                      <TableCell className="rh-num text-right">
                        {m.mentionCount > 0 ? (
                          m.mentionCount.toLocaleString("id-ID")
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {m.collectedAt ? (
                          <time
                            dateTime={m.collectedAt}
                            title={new Date(m.collectedAt).toLocaleString("id-ID")}
                          >
                            {formatRelativeTime(new Date(m.collectedAt))}
                          </time>
                        ) : (
                          "Belum pernah"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-0.5">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            disabled={pending || running}
                            onClick={() => handleRefresh(m)}
                            aria-label={`Sync ulang "${m.name}"`}
                            title="Sync ulang"
                          >
                            <RefreshCw aria-hidden />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => handleToggleActive(m)}
                            aria-label={
                              m.isActive
                                ? `Nonaktifkan sync terjadwal "${m.name}"`
                                : `Aktifkan sync terjadwal "${m.name}"`
                            }
                            title={m.isActive ? "Nonaktifkan" : "Aktifkan"}
                          >
                            {m.isActive ? <Pause aria-hidden /> : <Play aria-hidden />}
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            disabled={pending}
                            onClick={() => setDeleteTarget(m)}
                            aria-label={`Hapus "${m.name}"`}
                            title="Hapus"
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </ResearchTable>
          )}
        </section>
      ) : null}

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Hapus monitor "${deleteTarget?.name ?? ""}"?`}
        description="Semua batch sync, mention, dan hasil klasifikasi AI monitor ini ikut terhapus. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Hapus monitor"
        pending={pending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
