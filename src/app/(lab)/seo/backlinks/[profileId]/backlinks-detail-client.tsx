"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EChartsOption } from "echarts";
import { SeoAnalysisStatus } from "@prisma/client";
import {
  ArrowLeft,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EChart } from "@/components/lab/echart";
import { SeoDetailPage } from "@/components/seo/seo-module-page";
import { SeoStatusBadge } from "@/components/seo/seo-status-badge";
import { lab } from "@/components/lab/lab-primitives";
import { isSeoStatusBusy } from "@/lib/seo/labels";
import type { SelectItemDef } from "@/lib/select-option-items";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  addBacklinkGap,
  deleteBacklinkGap,
  refreshSeoBacklinkProfile,
} from "@/actions/seo-backlinks";
import { cn } from "@/lib/utils";

type GapDomain = { domain: string; rank: number | null; backlinks: number | null };

export type BacklinkDetail = {
  id: string;
  name: string;
  target: string;
  status: SeoAnalysisStatus;
  summary: Record<string, unknown> | null;
  topReferringDomains: {
    domain: string;
    rank: number | null;
    backlinks: number | null;
  }[];
  topAnchors: { anchor: string; backlinks: number | null; referringDomains: number | null }[];
  history: {
    date: string;
    backlinks: number | null;
    referringDomains: number | null;
  }[];
  dataNotice: string | null;
  errorMessage: string | null;
  gaps: {
    id: string;
    competitor: string;
    status: SeoAnalysisStatus;
    gapCount: number;
    gapDomains: GapDomain[];
    errorMessage: string | null;
  }[];
};

type RefSortKey = "backlinks" | "rank" | "domain";

const REF_SORT_ITEMS: SelectItemDef[] = [
  { value: "backlinks", label: "Backlink terbanyak" },
  { value: "rank", label: "Rank tertinggi" },
  { value: "domain", label: "Abjad" },
];

function num(value: unknown): string {
  return typeof value === "number" ? value.toLocaleString("id-ID") : "—";
}

function statNum(stats: Record<string, unknown>, key: string): number | null {
  const v = stats[key];
  return typeof v === "number" ? v : null;
}

export function BacklinksDetailClient({ profile }: { profile: BacklinkDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const [competitor, setCompetitor] = useState("");
  const [domainQuery, setDomainQuery] = useState("");
  const [refSort, setRefSort] = useState<RefSortKey>("backlinks");
  const [anchorQuery, setAnchorQuery] = useState("");

  const busy = isSeoStatusBusy(profile.status);
  const anyGapBusy = profile.gaps.some((g) => isSeoStatusBusy(g.status));
  useEffect(() => {
    if (!busy && !anyGapBusy) return;
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 4000);
    return () => clearInterval(timer);
  }, [busy, anyGapBusy, router]);

  const s = profile.summary ?? {};

  /* ------------------------------ Statistik hero ------------------------------ */
  const totalBacklinks = statNum(s, "backlinks");
  const dofollow = statNum(s, "dofollow");
  const nofollow =
    totalBacklinks != null && dofollow != null
      ? Math.max(totalBacklinks - dofollow, 0)
      : null;

  /* --------------------------- Tabel: filter + sortir --------------------------- */
  const visibleDomains = useMemo(() => {
    const q = domainQuery.trim().toLowerCase();
    const list = profile.topReferringDomains.filter(
      (d) => !q || d.domain.toLowerCase().includes(q),
    );
    const sorted = [...list];
    switch (refSort) {
      case "backlinks":
        sorted.sort((a, b) => (b.backlinks ?? -1) - (a.backlinks ?? -1));
        break;
      case "rank":
        sorted.sort((a, b) => (b.rank ?? -1) - (a.rank ?? -1));
        break;
      case "domain":
        sorted.sort((a, b) => a.domain.localeCompare(b.domain, "id"));
        break;
    }
    return sorted.slice(0, 20);
  }, [profile.topReferringDomains, domainQuery, refSort]);

  const visibleAnchors = useMemo(() => {
    const q = anchorQuery.trim().toLowerCase();
    return profile.topAnchors
      .filter((a) => !q || a.anchor.toLowerCase().includes(q))
      .slice(0, 20);
  }, [profile.topAnchors, anchorQuery]);

  const chartOption = useMemo<EChartsOption | null>(() => {
    const pts = profile.history.filter(
      (h) => h.backlinks != null || h.referringDomains != null,
    );
    if (pts.length < 2) return null;
    return {
      tooltip: { trigger: "axis" },
      legend: { top: 0 },
      grid: { left: 50, right: 16, top: 30, bottom: 28 },
      xAxis: { type: "time" },
      yAxis: { type: "value" },
      series: [
        {
          name: "Backlinks",
          type: "line",
          showSymbol: false,
          data: pts.map((h) => [h.date, h.backlinks] as [string, number | null]),
        },
        {
          name: "Referring domains",
          type: "line",
          showSymbol: false,
          data: pts.map(
            (h) => [h.date, h.referringDomains] as [string, number | null],
          ),
        },
      ],
    };
  }, [profile.history]);

  function handleRefresh() {
    setRefreshing(true);
    startTransition(async () => {
      try {
        await refreshSeoBacklinkProfile(profile.id);
        toast.success("Analisis ulang dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh."));
      } finally {
        setRefreshing(false);
      }
    });
  }

  function handleAddGap() {
    if (!competitor.trim()) {
      toast.error("Domain kompetitor wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await addBacklinkGap({ profileId: profile.id, competitor: competitor.trim() });
        setCompetitor("");
        toast.success("Menghitung backlink gap…");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menambah gap."));
      }
    });
  }

  function handleDeleteGap(id: string) {
    startTransition(async () => {
      try {
        await deleteBacklinkGap(id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus gap."));
      }
    });
  }

  return (
    <SeoDetailPage
      icon={Link2}
      title={profile.name}
      description={profile.target}
      right={
        <div className="flex items-center gap-2">
          <SeoStatusBadge status={profile.status} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={pending || refreshing || busy}
          >
            <RefreshCw className={cn(refreshing && "animate-spin")} />
            Analisis ulang
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/seo/backlinks" />}>
            <ArrowLeft />
            Kembali
          </Button>
        </div>
      }
    >
      {profile.status === SeoAnalysisStatus.FAILED && profile.errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {profile.errorMessage}
        </div>
      ) : null}
      {profile.dataNotice ? (
        <div className={cn(lab.nestedPanel, "text-muted-foreground text-sm")}>
          {profile.dataNotice}
        </div>
      ) : null}

      {/* Papan bento: total backlink + komposisi + statistik profil */}
      <div className="grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Tile hero teal */}
        <div className="bento-tile col-span-2 row-span-2 border-transparent bg-teal-600 shadow-md shadow-teal-600/20 lg:col-span-1 dark:bg-teal-500">
          <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
            Total backlink
          </span>
          <span className="bento-value text-5xl text-white dark:text-teal-950">
            {num(totalBacklinks)}
          </span>
          <span className="truncate text-[11px] font-medium leading-snug text-teal-100/90 dark:text-teal-900/80">
            menaut ke {profile.target}
          </span>
        </div>

        {/* Komposisi backlink (dofollow vs nofollow) */}
        {totalBacklinks != null &&
        totalBacklinks > 0 &&
        dofollow != null &&
        nofollow != null ? (
          <div className="bento-tile col-span-2 row-span-2 justify-start gap-3">
            <div className="flex items-center justify-between">
              <span className="bento-label">Komposisi backlink</span>
              <span className="text-muted-foreground text-[11px] tabular-nums">
                {num(totalBacklinks)} link
              </span>
            </div>
            <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
              {dofollow > 0 ? (
                <div
                  className="bg-emerald-500"
                  style={{ width: `${(dofollow / totalBacklinks) * 100}%` }}
                  title={`Dofollow: ${dofollow}`}
                />
              ) : null}
              {nofollow > 0 ? (
                <div
                  className="bg-muted-foreground/25"
                  style={{ width: `${(nofollow / totalBacklinks) * 100}%` }}
                  title={`Nofollow: ${nofollow}`}
                />
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              {[
                { label: "Dofollow", count: dofollow, dot: "bg-emerald-500" },
                {
                  label: "Nofollow",
                  count: nofollow,
                  dot: "bg-muted-foreground/25",
                },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-2 text-xs">
                  <span
                    className={cn("size-2 shrink-0 rounded-full", row.dot)}
                    aria-hidden
                  />
                  <span className="text-muted-foreground flex-1">{row.label}</span>
                  <span className="font-semibold tabular-nums">
                    {row.count.toLocaleString("id-ID")}
                  </span>
                  <span className="text-muted-foreground w-10 text-right text-[11px] tabular-nums">
                    {Math.round((row.count / totalBacklinks) * 100)}%
                  </span>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground mt-auto text-[11px] leading-snug">
              Backlink dofollow meneruskan otoritas — makin besar porsinya,
              makin kuat profilnya.
            </p>
          </div>
        ) : null}

        <div className="bento-tile">
          <span className="bento-label">Rank</span>
          <span className="bento-value">{num(s.rank)}</span>
          <span className="text-muted-foreground text-[11px] font-medium">
            otoritas domain target
          </span>
        </div>

        <div className="bento-tile">
          <span className="bento-label">Referring domain</span>
          <span className="bento-value">{num(s.referringDomains)}</span>
          <span className="text-muted-foreground text-[11px] font-medium">
            domain unik yang menaut
          </span>
        </div>

        <div className="bento-tile">
          <span className="bento-label">Dofollow</span>
          <span className="bento-value text-emerald-600 dark:text-emerald-400">
            {num(s.dofollow)}
          </span>
          <span className="text-muted-foreground text-[11px] font-medium">
            link meneruskan otoritas
          </span>
        </div>

        <div className="bento-tile">
          <span className="bento-label">Broken</span>
          <span className="bento-value text-amber-600 dark:text-amber-400">
            {num(s.brokenBacklinks)}
          </span>
          <span className="text-muted-foreground text-[11px] font-medium">
            backlink rusak
          </span>
        </div>

        <div className="bento-tile">
          <span className="bento-label">Spam score</span>
          <span className="bento-value">{num(s.spamScore)}</span>
          <span className="text-muted-foreground text-[11px] font-medium">
            indikasi link berkualitas rendah
          </span>
        </div>

        <div className="bento-tile">
          <span className="bento-label">Gap dianalisis</span>
          <span className="bento-value">{profile.gaps.length}</span>
          <span className="text-muted-foreground text-[11px] font-medium">
            kompetitor dibandingkan
          </span>
        </div>
      </div>

      {/* Grafik tren */}
      {chartOption ? (
        <div className="bento-tile justify-start gap-2">
          <div className="flex items-center justify-between">
            <span className="bento-label">Tren backlink</span>
            <span className="text-muted-foreground text-[11px]">
              backlink & referring domain per pengecekan
            </span>
          </div>
          <EChart option={chartOption} height={280} />
        </div>
      ) : null}

      {/* Tabel referring domain + anchor */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className={cn(lab.card, "p-0")}>
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-foreground font-bold tracking-tight">
                Top referring domains
              </p>
              <p className="text-muted-foreground text-xs">
                {visibleDomains.length === profile.topReferringDomains.length
                  ? `${profile.topReferringDomains.length} domain`
                  : `${visibleDomains.length} dari ${profile.topReferringDomains.length} domain`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
                <Input
                  value={domainQuery}
                  onChange={(e) => setDomainQuery(e.target.value)}
                  placeholder="Cari domain…"
                  className="h-9 w-40 pl-8 text-xs"
                />
              </div>
              <Select
                value={refSort}
                items={REF_SORT_ITEMS}
                onValueChange={(v) => {
                  if (v) setRefSort(v as RefSortKey);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  {REF_SORT_ITEMS.find((i) => i.value === refSort)?.label ?? ""}
                </SelectTrigger>
                <SelectContent>
                  {REF_SORT_ITEMS.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {profile.topReferringDomains.length === 0 ? (
            <p className="text-muted-foreground p-4 pt-0 text-sm">
              Belum ada data.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead className="text-right">Rank</TableHead>
                    <TableHead className="text-right">Backlinks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleDomains.map((d) => (
                    <TableRow key={d.domain}>
                      <TableCell className="max-w-[240px] truncate text-sm">
                        {d.domain}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(d.rank)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(d.backlinks)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className={cn(lab.card, "p-0")}>
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-foreground font-bold tracking-tight">
                Top anchor text
              </p>
              <p className="text-muted-foreground text-xs">
                {visibleAnchors.length === profile.topAnchors.length
                  ? `${profile.topAnchors.length} anchor`
                  : `${visibleAnchors.length} dari ${profile.topAnchors.length} anchor`}
              </p>
            </div>
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
              <Input
                value={anchorQuery}
                onChange={(e) => setAnchorQuery(e.target.value)}
                placeholder="Cari anchor…"
                className="h-9 w-40 pl-8 text-xs"
              />
            </div>
          </div>
          {profile.topAnchors.length === 0 ? (
            <p className="text-muted-foreground p-4 pt-0 text-sm">
              Belum ada data.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anchor</TableHead>
                    <TableHead className="text-right">Backlinks</TableHead>
                    <TableHead className="text-right">Ref. domain</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleAnchors.map((a, i) => (
                    <TableRow key={`${a.anchor}-${i}`}>
                      <TableCell className="max-w-[240px] truncate text-sm">
                        {a.anchor}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(a.backlinks)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(a.referringDomains)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Backlink gap */}
      <div className="bento-tile justify-start gap-3">
        <div className="flex items-center justify-between">
          <span className="bento-label">Backlink gap vs kompetitor</span>
          <span className="text-muted-foreground text-[11px]">
            domain yang menaut ke mereka, belum ke kamu
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid flex-1 gap-1.5">
            <Label>Domain kompetitor</Label>
            <Input
              value={competitor}
              onChange={(e) => setCompetitor(e.target.value)}
              placeholder="kompetitor.com"
              disabled={pending}
            />
          </div>
          <Button onClick={handleAddGap} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Plus />}
            Hitung gap
          </Button>
        </div>

        {profile.gaps.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Tambahkan kompetitor untuk melihat domain yang menaut ke mereka tapi
            belum ke kamu.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {profile.gaps.map((gap) => (
              <div key={gap.id} className={cn(lab.nestedPanel)}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-medium">{gap.competitor}</span>
                  <div className="flex items-center gap-2">
                    {isSeoStatusBusy(gap.status) ? (
                      <SeoStatusBadge status={gap.status} />
                    ) : (
                      <span className="rounded-lg bg-amber-500/15 px-2 py-1 text-xs font-bold tabular-nums text-amber-700 dark:text-amber-300">
                        {gap.gapCount} domain gap
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteGap(gap.id)}
                      disabled={pending}
                      aria-label="Hapus gap"
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                </div>
                {gap.errorMessage ? (
                  <p className="text-destructive text-xs">{gap.errorMessage}</p>
                ) : gap.gapDomains.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {gap.gapDomains.slice(0, 15).map((d) => (
                      <span
                        key={d.domain}
                        className="bg-muted/60 rounded-lg px-2 py-1 text-xs font-medium"
                      >
                        {d.domain}
                      </span>
                    ))}
                    {gap.gapDomains.length > 15 ? (
                      <span className="text-muted-foreground px-1 text-xs">
                        +{gap.gapDomains.length - 15} lagi
                      </span>
                    ) : null}
                  </div>
                ) : !isSeoStatusBusy(gap.status) ? (
                  <p className="text-muted-foreground text-xs">
                    Tidak ada gap — kamu sudah punya semua referring domain mereka. 🎉
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </SeoDetailPage>
  );
}
