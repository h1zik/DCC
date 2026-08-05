"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Link2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserSearch,
} from "lucide-react";
import {
  InfluencerAuditStatus,
  InfluencerPlatform,
  InfluencerTier,
  InfluencerVerdict,
} from "@prisma/client";
import { toast } from "sonner";
import {
  addInfluencerForAudit,
  deleteInfluencerProfile,
  reauditInfluencer,
} from "@/actions/brand-influencer";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
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
import { lab, LabCard, LabEmptyState, LabStatChip } from "@/components/lab/lab-primitives";
import {
  AuditStatusPill,
  compactNumber,
  ConfidenceBadge,
  InfluencerAvatar,
  isAuditInProgress,
  PLATFORM_LABEL,
  TIER_LABEL,
  VerdictBadge,
} from "@/components/brand-hub/influencer-badges";
import { brandHubHref, useBrandHubBrandId } from "@/hooks/use-brand-hub-brand-id";
import { useBrandJobProgress } from "../use-brand-job-progress";
import { cn } from "@/lib/utils";

export type InfluencerRow = {
  id: string;
  platform: InfluencerPlatform;
  handle: string;
  profileUrl: string;
  displayName: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  brandName: string | null;
  auditCount: number;
  latestStatus: InfluencerAuditStatus | null;
  errorMessage: string | null;
  collectedAt: string | null;
  followers: number | null;
  tier: InfluencerTier | null;
  engagementRate: number | null;
  benchmarkEr: number | null;
  score: number | null;
  verdict: InfluencerVerdict | null;
  authenticityScore: number | null;
  confidence: string | null;
  expectedCampaignEr: number | null;
  sponsoredDeltaPct: number | null;
  flagCount: number;
};

type HubStats = {
  total: number;
  audited: number;
  recommended: number;
  suspicious: number;
  avgScore: number;
};

function CardStat({ label, value }: { label: string; value: React.ReactNode }) {
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

function AddInfluencerDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const brandId = useBrandHubBrandId();

  function submit() {
    if (!url.trim()) {
      toast.error("Tempel link profil influencer dulu.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await addInfluencerForAudit({
          url: url.trim(),
          ownerBrandId: brandId,
          notes: notes.trim() || null,
        });
        toast.success(
          result.reused
            ? "Influencer sudah pernah ditambahkan — audit ulang dijalankan."
            : "Influencer ditambahkan, audit sedang berjalan.",
        );
        setUrl("");
        setNotes("");
        setOpen(false);
        onAdded();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menambahkan influencer."));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="gap-1.5">
            <Plus className="size-4" />
            Audit Influencer
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader className="gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_12%,transparent)] text-[var(--lab-accent,var(--primary))]">
              <UserSearch className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <DialogTitle>Audit influencer baru</DialogTitle>
              <DialogDescription>
                Tempel link profil Instagram atau TikTok. Kami ambil post
                terbaru, hitung engagement rate relatif terhadap tier follower,
                dan periksa tanda-tanda engagement yang dibeli.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="inf-url" className="flex items-center gap-1.5">
              <Link2 className="text-muted-foreground size-3.5" />
              Link profil
            </Label>
            <Input
              id="inf-url"
              placeholder="https://www.instagram.com/username"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !pending) submit();
              }}
            />
            <p className="text-muted-foreground text-xs leading-relaxed">
              Harus link <strong>profil</strong>, bukan link post. Contoh:
              instagram.com/username atau tiktok.com/@username
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="inf-notes">
              Catatan{" "}
              <span className="text-muted-foreground font-normal">(opsional)</span>
            </Label>
            <Textarea
              id="inf-notes"
              placeholder="Mis. kandidat kampanye Ramadan, rate card 5jt/post"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={pending} className="gap-1.5">
            {pending ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <UserSearch className="size-4" />
            )}
            Jalankan audit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfluencerCard({
  row,
  brandId,
  onChanged,
}: {
  row: InfluencerRow;
  brandId: string | null;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const running = isAuditInProgress(row.latestStatus);

  function reaudit() {
    startTransition(async () => {
      try {
        await reauditInfluencer(row.id);
        toast.success(`Audit ulang @${row.handle} dijalankan.`);
        onChanged();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menjalankan audit ulang."));
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        await deleteInfluencerProfile(row.id);
        toast.success(`@${row.handle} dihapus.`);
        onChanged();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus influencer."));
      }
    });
  }

  const erVsBenchmark =
    row.engagementRate !== null && row.benchmarkEr
      ? row.engagementRate / row.benchmarkEr
      : null;

  return (
    <LabCard interactive className="flex flex-col">
      <div className={cn(lab.cardBody, "flex flex-1 flex-col gap-4")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <InfluencerAvatar
              src={row.avatarUrl}
              handle={row.handle}
              className="size-11 text-sm"
            />
            <div className="min-w-0">
              <p className="text-foreground flex items-center gap-1.5 truncate text-sm font-bold">
                @{row.handle}
                {row.isVerified ? (
                  <BadgeCheck className="size-3.5 shrink-0 text-sky-500" aria-hidden />
                ) : null}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {PLATFORM_LABEL[row.platform]}
                {row.displayName ? ` · ${row.displayName}` : ""}
                {row.brandName ? ` · ${row.brandName}` : ""}
              </p>
            </div>
          </div>
          <VerdictBadge verdict={row.verdict} />
        </div>

        {row.latestStatus === InfluencerAuditStatus.FAILED && row.errorMessage ? (
          <p className="rounded-lg border border-rose-300/60 bg-rose-50/60 p-2.5 text-xs leading-relaxed text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200">
            {row.errorMessage}
          </p>
        ) : null}

        {row.latestStatus === InfluencerAuditStatus.READY ? (
          <div className="grid grid-cols-4 gap-3">
            <CardStat label="Follower" value={compactNumber(row.followers ?? 0)} />
            <CardStat
              label="ER"
              value={`${(row.engagementRate ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`}
            />
            <CardStat
              label="vs median"
              value={erVsBenchmark ? `${erVsBenchmark.toFixed(1)}×` : "—"}
            />
            <CardStat
              label="Perkiraan campaign"
              value={
                row.expectedCampaignEr !== null
                  ? `${row.expectedCampaignEr.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`
                  : "—"
              }
            />
          </div>
        ) : null}

        {row.sponsoredDeltaPct !== null && row.sponsoredDeltaPct < -20 ? (
          <p className="rounded-lg border border-amber-300/60 bg-amber-50/60 p-2.5 text-xs leading-relaxed text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
            Engagement post berbayar{" "}
            <strong>{Math.abs(row.sponsoredDeltaPct).toFixed(0)}% lebih rendah</strong>{" "}
            dari post organiknya.
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-2">
          <AuditStatusPill status={row.latestStatus} />
          {row.confidence && row.latestStatus === InfluencerAuditStatus.READY ? (
            <ConfidenceBadge confidence={row.confidence} />
          ) : null}
          {row.tier ? (
            <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-[11px] font-semibold">
              {TIER_LABEL[row.tier]}
            </span>
          ) : null}
          {row.flagCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
              <ShieldAlert className="size-3" aria-hidden />
              {row.flagCount} sinyal
            </span>
          ) : null}
        </div>
      </div>

      <div className="border-border/60 flex items-center justify-between gap-2 border-t px-5 py-3 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          render={
            <Link
              href={brandHubHref(`/brand-hub/influencer-audit/${row.id}`, brandId)}
            />
          }
        >
          Lihat detail
          <ArrowUpRight className="size-3.5" />
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={reaudit}
            disabled={pending || running}
            title="Audit ulang"
            className="gap-1.5"
          >
            <RefreshCw className={cn("size-3.5", pending && "animate-spin")} />
            <span className="sr-only sm:not-sr-only">Audit ulang</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={remove}
            disabled={pending || running}
            title="Hapus"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            <span className="sr-only">Hapus</span>
          </Button>
        </div>
      </div>
    </LabCard>
  );
}

export function InfluencerAuditClient({
  profiles,
  stats,
}: {
  profiles: InfluencerRow[];
  stats: HubStats;
}) {
  const router = useRouter();
  const brandId = useBrandHubBrandId();
  const anyRunning = profiles.some((p) => isAuditInProgress(p.latestStatus));

  useBrandJobProgress({ inProgress: anyRunning });

  const refresh = () => router.refresh();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <LabStatChip label="Influencer" value={stats.total} />
          <LabStatChip label="Sudah diaudit" value={stats.audited} />
          <LabStatChip
            label="Layak"
            value={stats.recommended}
            tone={stats.recommended > 0 ? "success" : "neutral"}
          />
          <LabStatChip
            label="Mencurigakan"
            value={stats.suspicious}
            tone={stats.suspicious > 0 ? "danger" : "neutral"}
          />
          <LabStatChip label="Rata-rata skor" value={stats.avgScore} />
        </div>
        <AddInfluencerDialog onAdded={refresh} />
      </div>

      {profiles.length === 0 ? (
        <LabEmptyState
          icon={UserSearch}
          title="Belum ada influencer yang diaudit"
          description="Tempel link profil Instagram atau TikTok. Kami hitung engagement rate terhadap follower dan terhadap view, bandingkan dengan median tier-nya, lalu periksa tanda-tanda engagement yang dibeli."
          action={<AddInfluencerDialog onAdded={refresh} />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {profiles.map((row) => (
            <InfluencerCard
              key={row.id}
              row={row}
              brandId={brandId}
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
