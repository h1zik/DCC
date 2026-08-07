"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  FilterX,
  Loader2,
  Radar,
  RefreshCw,
  Search,
  SearchX,
  Sparkles,
  Tags,
  Trash2,
  UserSearch,
} from "lucide-react";
import { InfluencerPlatform, InfluencerTier } from "@prisma/client";
import { toast } from "sonner";
import {
  auditCreatorFromRadar,
  classifyCreators,
  deleteDiscoveryRun,
  enrichPendingCreators,
  startInfluencerDiscovery,
} from "@/actions/brand-influencer-discovery";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  CATEGORY_CONFIDENCE_TRUSTED,
  creatorCategoryLabel,
} from "@/lib/brand-research/influencer/discovery/categories";
import {
  MAX_DISCOVERY_TERMS,
  parseDiscoveryTerms,
} from "@/lib/brand-research/influencer/discovery/discovery-limits";
import {
  countActiveRadarFilters,
  isRadarFilterActive,
  radarFilterQuery,
  RADAR_SORT_LABEL,
  type RadarFilterState,
  type RadarSortKey,
} from "@/lib/brand-research/influencer/discovery/radar-query";
import type {
  RadarPage,
  RadarStats,
} from "@/lib/brand-research/influencer/discovery/radar-readers";
import {
  formatRelativeTime,
  formatRelativeTimeCompact,
} from "@/lib/research/labels";
import {
  DEFAULT_TIKTOK_SEARCH_LIMIT,
  MAX_TIKTOK_SEARCH_LIMIT,
} from "@/lib/research/social-listening/search-limits-public";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SelectItemDef } from "@/lib/select-option-items";
import {
  compactNumber,
  InfluencerAvatar,
  PLATFORM_LABEL,
  TIER_LABEL,
  TIER_RANGE_LABEL,
  VerdictBadge,
} from "@/components/brand-hub/influencer-badges";
import {
  brandHubHref,
  useBrandHubBrandId,
} from "@/hooks/use-brand-hub-brand-id";
import {
  LabCard,
  LabEmptyState,
  LabStatChip,
  LabToolbar,
} from "@/components/lab/lab-primitives";
import { cn } from "@/lib/utils";

const RADAR_PATH = "/brand-hub/kol-radar";

const POLL_INTERVAL_MS = 15_000;
/**
 * Pagar untuk crawl yang tersangkut: tanpa ini, satu run yang tak pernah keluar
 * dari COLLECTING membuat tab menyegarkan diri selamanya.
 */
const MAX_POLL_TICKS = 40;

const CRAWL_PLATFORM_ITEMS: SelectItemDef[] = [
  { value: "both", label: "TikTok + Instagram" },
  { value: InfluencerPlatform.TIKTOK, label: "TikTok saja" },
  { value: InfluencerPlatform.INSTAGRAM, label: "Instagram saja" },
];

export type DiscoveryRunRow = {
  id: string;
  status: string;
  terms: string[];
  /** Kosong berarti kedua platform disisir. */
  platforms: InfluencerPlatform[];
  searchLimit: number;
  postsScanned: number;
  profilesFound: number;
  profilesNew: number;
  warnings: string[];
  errorMessage: string | null;
  createdAt: string;
  finishedAt: string | null;
  createdByName: string | null;
};

const num = (n: number) => n.toLocaleString("id-ID");

function pct(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

/** ER disimpan dengan 3 desimal; dua sudah lebih presisi dari yang berguna. */
function formatEr(value: number): string {
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;
}

/**
 * Kata kunci ditampilkan sebagai hashtag hanya kalau memang bisa jadi hashtag —
 * "#review skincare" adalah bentuk yang tidak pernah ada di platform mana pun.
 */
function termChipLabel(term: string): string {
  return term.includes(" ") ? term : `#${term}`;
}

/** Waktu relatif dihitung dari jam browser, jadi SSR dan klien boleh berbeda. */
function Ago({ iso }: { iso: string | null }) {
  return (
    <span suppressHydrationWarning>
      {formatRelativeTime(iso ? new Date(iso) : null)}
    </span>
  );
}

function AgoCompact({ iso }: { iso: string }) {
  return (
    <span suppressHydrationWarning>
      {formatRelativeTimeCompact(new Date(iso))}
    </span>
  );
}

/** URL halaman untuk sebuah keadaan filter, dengan brand aktif tetap terbawa. */
function radarHref(filters: RadarFilterState, brandId: string | null): string {
  const query = radarFilterQuery(filters);
  return brandHubHref(query ? `${RADAR_PATH}?${query}` : RADAR_PATH, brandId);
}

export function KolRadarClient({
  filters,
  page,
  stats,
  categories,
  runs,
}: {
  filters: RadarFilterState;
  page: RadarPage;
  stats: RadarStats;
  categories: { category: string; count: number }[];
  runs: DiscoveryRunRow[];
}) {
  const router = useRouter();
  // Brand aktif dipilih di sidebar Brand Hub dan hidup di URL. Setiap navigasi
  // di halaman ini membangun ulang query dari nol, jadi harus disisipkan lagi —
  // kalau tidak, mengubah satu filter diam-diam melempar orang kembali ke
  // "semua brand".
  const brandId = useBrandHubBrandId();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(filters.search);
  const [crawlOpen, setCrawlOpen] = useState(false);

  const runningJobs = stats.runningDiscovery + stats.runningEnrichment;

  /**
   * Selama masih ada job Apify berjalan, halaman menyegarkan diri sendiri.
   * Tanpa ini pengguna melihat "0 kreator" dan menyimpulkan crawl-nya gagal,
   * padahal hasilnya baru masuk satu-dua menit kemudian.
   */
  useEffect(() => {
    if (runningJobs === 0) return;
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      if (ticks > MAX_POLL_TICKS) {
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [runningJobs, router]);

  // Filter terbaru disimpan di ref supaya efek debounce di bawah tidak perlu
  // memasukkan objek `filters` (identitas baru tiap render) ke dependensinya.
  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  });

  /**
   * Kotak pencarian dikendalikan lokal; URL baru diperbarui setelah orang
   * berhenti mengetik, supaya tiap huruf tidak memicu query database.
   *
   * `replace`, bukan `push`: mengetik "skincare" lewat push akan menumpuk
   * entri riwayat per jeda ketik, dan tombol kembali jadi tidak berguna.
   */
  useEffect(() => {
    if (search === filters.search) return;
    const timer = setTimeout(() => {
      router.replace(
        radarHref({ ...filtersRef.current, search, page: 1 }, brandId),
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [search, filters.search, brandId, router]);

  function apply(patch: Partial<RadarFilterState>) {
    router.push(radarHref({ ...filters, ...patch }, brandId));
  }

  function goToPage(next: number) {
    apply({ page: next });
    // Tanpa ini, halaman berikutnya terbuka di posisi gulir yang sama dan
    // terbaca seperti daftar yang tidak berubah.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetFilters() {
    setSearch("");
    router.push(brandHubHref(RADAR_PATH, brandId));
  }

  function runAction(fn: () => Promise<string>): void {
    startTransition(async () => {
      try {
        toast.success(await fn());
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Tindakan gagal dijalankan."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <LabStatChip
          label="Kreator"
          value={num(stats.totalCreators)}
          tone="primary"
        />
        <LabStatChip
          label="Sudah terukur"
          value={
            <ValueWithShare part={stats.measured} total={stats.totalCreators} />
          }
          tone="accent"
        />
        <LabStatChip
          label="Berkategori"
          value={
            <ValueWithShare
              part={stats.classified}
              total={stats.totalCreators}
            />
          }
        />
        <LabStatChip
          label="Diaudit penuh"
          value={num(stats.audited)}
          tone="success"
        />
        {runningJobs > 0 && (
          <LabStatChip
            label="Job berjalan"
            value={
              <span className="inline-flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" aria-hidden />
                {runningJobs}
              </span>
            }
            tone="warning"
          />
        )}
      </div>

      <LabToolbar className="flex-col items-stretch gap-0 p-0">
        <div className="flex flex-wrap items-center gap-2 p-2">
          <Button
            size="sm"
            className="gap-1.5"
            disabled={pending}
            onClick={() => setCrawlOpen(true)}
          >
            <Sparkles className="size-4" aria-hidden />
            Sisir hashtag
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={pending || stats.pendingMeasurement === 0}
            title={
              stats.pendingMeasurement === 0
                ? "Semua kreator sudah punya angka."
                : `${num(stats.pendingMeasurement)} kreator belum pernah diukur follower dan engagement-nya.`
            }
            onClick={() =>
              runAction(async () => {
                const r = await enrichPendingCreators();
                return r.queued === 0
                  ? "Semua kreator sudah punya angka."
                  : `${num(r.queued)} kreator diantre dalam ${r.batches} batch.`;
              })
            }
          >
            <RefreshCw className="size-4" aria-hidden />
            Ukur yang belum
            <PendingCount value={stats.pendingMeasurement} />
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={pending || stats.pendingClassification === 0}
            title={
              stats.pendingClassification === 0
                ? "Semua kreator sudah punya kategori yang masih segar."
                : `${num(stats.pendingClassification)} kreator belum berkategori atau labelnya sudah kedaluwarsa.`
            }
            onClick={() =>
              runAction(async () => {
                const r = await classifyCreators();
                return r.classified === 0
                  ? "Tidak ada kreator yang perlu diklasifikasi."
                  : `${num(r.classified)} kreator diberi kategori.`;
              })
            }
          >
            <Tags className="size-4" aria-hidden />
            Klasifikasi niche
            <PendingCount value={stats.pendingClassification} />
          </Button>

          <div className="relative ml-auto min-w-[200px] flex-1 sm:max-w-xs">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari handle atau nama…"
              className="pl-8"
              aria-label="Cari kreator"
            />
          </div>
        </div>

        <div className="border-border/60 flex flex-wrap items-center gap-2 border-t p-2">
          <FilterSelect
            label="Platform"
            value={filters.platform}
            onChange={(v) =>
              apply({ platform: v as RadarFilterState["platform"], page: 1 })
            }
            options={[
              { value: "all", label: "Semua platform" },
              { value: InfluencerPlatform.TIKTOK, label: "TikTok" },
              { value: InfluencerPlatform.INSTAGRAM, label: "Instagram" },
            ]}
          />

          <FilterSelect
            label="Kategori"
            value={filters.category}
            onChange={(v) => apply({ category: v, page: 1 })}
            options={[
              { value: "all", label: "Semua kategori" },
              ...categories.map((c) => ({
                value: c.category,
                label: `${creatorCategoryLabel(c.category)} (${num(c.count)})`,
              })),
              { value: "unclassified", label: "Belum diklasifikasi" },
            ]}
          />

          <FilterSelect
            label="Tier"
            value={filters.tier}
            onChange={(v) =>
              apply({ tier: v as RadarFilterState["tier"], page: 1 })
            }
            options={[
              { value: "all", label: "Semua tier" },
              ...Object.values(InfluencerTier).map((t) => ({
                value: t,
                label: TIER_RANGE_LABEL[t],
              })),
            ]}
          />

          <FilterSelect
            label="Urutkan"
            value={filters.sort}
            onChange={(v) => apply({ sort: v as RadarSortKey, page: 1 })}
            options={Object.entries(RADAR_SORT_LABEL).map(([value, label]) => ({
              value,
              label,
            }))}
          />

          <Button
            variant={filters.measuredOnly ? "default" : "outline"}
            size="sm"
            aria-pressed={filters.measuredOnly}
            onClick={() =>
              apply({ measuredOnly: !filters.measuredOnly, page: 1 })
            }
          >
            Hanya yang terukur
          </Button>

          {isRadarFilterActive(filters) && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <FilterX className="size-4" aria-hidden />
              Reset ({countActiveRadarFilters(filters)})
            </Button>
          )}
        </div>
      </LabToolbar>

      {runs.length > 0 && <RunHistory runs={runs} />}

      {page.rows.length === 0 ? (
        <LabEmptyState
          icon={stats.totalCreators === 0 ? Radar : SearchX}
          title={
            stats.totalCreators === 0
              ? "Belum ada kreator di database"
              : "Tidak ada kreator yang cocok"
          }
          description={
            stats.totalCreators === 0
              ? "Mulai dengan menyisir satu hashtag yang relevan dengan produk Anda — misalnya #skincarelokal atau #reviewskincare."
              : "Longgarkan filternya, atau sisir hashtag lain untuk menambah kandidat."
          }
          action={
            stats.totalCreators === 0 ? (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setCrawlOpen(true)}
              >
                <Sparkles className="size-4" aria-hidden />
                Sisir hashtag
              </Button>
            ) : (
              isRadarFilterActive(filters) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={resetFilters}
                >
                  <FilterX className="size-4" aria-hidden />
                  Bersihkan {countActiveRadarFilters(filters)} filter
                </Button>
              )
            )
          }
        />
      ) : (
        <div className="grid gap-3">
          {page.rows.map((row) => (
            <CreatorCard key={row.id} row={row} brandId={brandId} />
          ))}
        </div>
      )}

      {page.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            Menampilkan {num(page.rows.length)} dari {num(page.total)} kreator
            {page.pageCount > 1
              ? ` · halaman ${page.page} dari ${page.pageCount}`
              : ""}
          </p>
          {page.pageCount > 1 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page.page <= 1}
                onClick={() => goToPage(page.page - 1)}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page.page >= page.pageCount}
                onClick={() => goToPage(page.page + 1)}
              >
                Berikutnya
              </Button>
            </div>
          )}
        </div>
      )}

      <CrawlDialog
        open={crawlOpen}
        onOpenChange={setCrawlOpen}
        onStarted={() => router.refresh()}
      />
    </div>
  );
}

function ValueWithShare({ part, total }: { part: number; total: number }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      {num(part)}
      {total > 0 && (
        <span className="text-muted-foreground text-[11px] font-normal">
          {pct(part, total)}%
        </span>
      )}
    </span>
  );
}

/** Sisa antrean di tombol aksi — 0 berarti tombolnya memang tidak perlu ditekan. */
function PendingCount({ value }: { value: number }) {
  if (value === 0) return null;
  return (
    <span className="bg-foreground/10 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
      {num(value)}
    </span>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select
      value={value}
      items={options}
      // Base UI mengizinkan nilai null (mis. saat pilihan dibersihkan); di sini
      // itu selalu berarti "kembali ke pilihan pertama", bukan filter kosong.
      onValueChange={(v) => onChange((v as string) ?? options[0].value)}
    >
      <SelectTrigger className="h-9 w-auto min-w-[150px]" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CreatorCard({
  row,
  brandId,
}: {
  row: RadarPage["rows"][number];
  brandId: string | null;
}) {
  const router = useRouter();
  // Transisi per kartu, bukan satu untuk seluruh halaman: mengaudit satu orang
  // tidak boleh mematikan tombol audit 24 kreator lain di layar.
  const [pending, startTransition] = useTransition();

  const uncertainCategory =
    row.category !== null &&
    (row.categoryConfidence ?? 0) < CATEGORY_CONFIDENCE_TRUSTED;

  const confidencePct = Math.round((row.categoryConfidence ?? 0) * 100);

  function audit() {
    startTransition(async () => {
      try {
        await auditCreatorFromRadar(row.id);
        toast.success(`Audit penuh @${row.handle} dimulai.`);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Audit gagal dijalankan."));
      }
    });
  }

  return (
    <LabCard
      interactive
      className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <InfluencerAvatar
          src={row.avatarUrl}
          handle={row.handle}
          className="size-10 text-xs"
        />

        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <a
              href={row.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-sm font-bold hover:underline"
            >
              @{row.handle}
            </a>
            {row.isVerified && (
              <BadgeCheck
                className="size-4 shrink-0 text-sky-500"
                aria-label="Terverifikasi"
              />
            )}
            <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase">
              {PLATFORM_LABEL[row.platform]}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                row.category === null
                  ? "bg-muted/60 text-muted-foreground"
                  : uncertainCategory
                    ? "bg-amber-500/10 text-amber-800 dark:text-amber-300"
                    : "bg-muted/60 text-foreground",
              )}
              title={
                uncertainCategory
                  ? `Keyakinan klasifikasi ${confidencePct}% — perlu dicek manual`
                  : undefined
              }
            >
              {creatorCategoryLabel(row.category)}
              {uncertainCategory && ` · ${confidencePct}%`}
            </span>
            {row.hasAudit && row.auditVerdict && (
              <VerdictBadge verdict={row.auditVerdict} className="py-0.5" />
            )}
          </div>

          <p className="text-muted-foreground truncate text-xs">
            {row.displayName ?? "—"}
          </p>

          {row.matchedTerms.length > 0 && (
            <p className="text-muted-foreground flex flex-wrap items-center gap-1 text-[11px]">
              <span>Ditemukan lewat</span>
              {row.matchedTerms.map((term) => (
                <span
                  key={term}
                  className="bg-muted/60 text-foreground rounded px-1.5 py-0.5 font-medium"
                >
                  {term}
                </span>
              ))}
              {row.discoveryCount > 1 && (
                <span
                  title="Makin sering muncul di crawl berbeda, makin pasti kreator ini memang berada di niche itu."
                  className="font-medium"
                >
                  · {num(row.discoveryCount)}× tertangkap
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/*
        Lebar kolom dipatok, bukan mengikuti isi: daftar ini dibaca menurun
        ("mana yang followernya paling besar"), dan kolom yang bergeser tiap
        baris memaksa mata mencari ulang di setiap kartu.
      */}
      <div className="grid shrink-0 grid-cols-[repeat(2,minmax(0,1fr))] gap-x-5 gap-y-2 text-xs sm:grid-cols-[repeat(4,72px)]">
        <Metric
          label="Follower"
          value={row.followers === null ? "—" : compactNumber(row.followers)}
        />
        <Metric
          label="ER"
          value={
            row.engagementRate === null ? "—" : formatEr(row.engagementRate)
          }
          hint={
            row.engagementRate === null && row.followers !== null
              ? "Engagement tidak terukur — kemungkinan like disembunyikan"
              : undefined
          }
        />
        <Metric label="Tier" value={row.tier ? TIER_LABEL[row.tier] : "—"} />
        <Metric
          label="Diukur"
          value={
            row.measuredAt ? <AgoCompact iso={row.measuredAt} /> : "belum"
          }
          hint={
            row.measuredAt
              ? undefined
              : "Belum pernah diukur — pakai tombol “Ukur yang belum” di atas."
          }
        />
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:w-[150px] sm:justify-end">
        {row.hasAudit ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            render={
              <Link
                href={brandHubHref(
                  `/brand-hub/influencer-audit/${row.id}`,
                  brandId,
                )}
              />
            }
          >
            <ArrowUpRight className="size-4" aria-hidden />
            Lihat audit
            {row.auditScore !== null && (
              <span className="font-semibold tabular-nums">
                {row.auditScore}
              </span>
            )}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={pending}
            onClick={audit}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <UserSearch className="size-4" aria-hidden />
            )}
            Audit penuh
          </Button>
        )}
      </div>
    </LabCard>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <span className="flex flex-col leading-tight" title={hint}>
      <span className="text-muted-foreground text-[10px] uppercase">
        {label}
      </span>
      <span className={cn("font-semibold tabular-nums", hint && "text-muted-foreground")}>
        {value}
      </span>
    </span>
  );
}

function RunHistory({ runs }: { runs: DiscoveryRunRow[] }) {
  const [open, setOpen] = useState(false);
  const visible = open ? runs : runs.slice(0, 2);

  return (
    <LabCard className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Riwayat crawl</h3>
        {runs.length > 2 && (
          <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
            {open ? "Ringkas" : `Lihat semua (${runs.length})`}
          </Button>
        )}
      </div>
      <ul className="divide-border/50 flex flex-col divide-y">
        {visible.map((run) => (
          <RunRow key={run.id} run={run} />
        ))}
      </ul>
    </LabCard>
  );
}

function RunRow({ run }: { run: DiscoveryRunRow }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const finished = run.status === "READY" || run.status === "FAILED";
  const platforms =
    run.platforms.length === 0
      ? "TikTok + Instagram"
      : run.platforms.map((p) => PLATFORM_LABEL[p]).join(" + ");

  function remove() {
    startTransition(async () => {
      try {
        await deleteDiscoveryRun(run.id);
        toast.success("Catatan crawl dihapus — kreatornya tetap ada.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus catatan crawl."));
      }
    });
  }

  return (
    <li className="flex flex-wrap items-start gap-x-2 gap-y-1 py-2 text-xs first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{run.terms.join(", ")}</span>
          <StatusBadge status={run.status} />
          {run.status === "READY" && (
            <span className="text-muted-foreground">
              {num(run.postsScanned)} post → {num(run.profilesFound)} kreator (
              {num(run.profilesNew)} baru)
            </span>
          )}
        </div>

        <p className="text-muted-foreground text-[11px]">
          {platforms} · maks. {num(run.searchLimit)} post/platform ·{" "}
          <Ago iso={run.finishedAt ?? run.createdAt} />
          {run.createdByName ? ` · oleh ${run.createdByName}` : ""}
        </p>

        {run.errorMessage && (
          <p className="rounded border border-rose-300/60 bg-rose-50/60 px-2 py-1 text-[11px] leading-relaxed text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200">
            {run.errorMessage}
          </p>
        )}

        {run.warnings.map((w, i) => (
          <p
            key={i}
            className="rounded border border-amber-300/50 bg-amber-50/50 px-2 py-1 text-[11px] leading-relaxed text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200"
          >
            {w}
          </p>
        ))}
      </div>

      {finished &&
        (confirming ? (
          <span className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive h-7 px-2"
              disabled={pending}
              onClick={remove}
            >
              {pending && (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              )}
              Hapus
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Batal
            </Button>
          </span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive h-7 shrink-0 px-2"
            title="Hapus catatan crawl ini. Kreator yang ditemukannya tetap ada di daftar."
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="size-3.5" aria-hidden />
            <span className="sr-only">Hapus catatan crawl</span>
          </Button>
        ))}
    </li>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    PENDING: { label: "Antre", className: "bg-muted text-muted-foreground" },
    COLLECTING: {
      label: "Berjalan",
      className: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
    },
    READY: {
      label: "Selesai",
      className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    FAILED: {
      label: "Gagal",
      className: "bg-red-500/10 text-red-700 dark:text-red-400",
    },
  };
  const s = map[status] ?? map.PENDING;

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.className}`}
    >
      {s.label}
    </span>
  );
}

function CrawlDialog({
  open,
  onOpenChange,
  onStarted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStarted: () => void;
}) {
  const [terms, setTerms] = useState("");
  const [platform, setPlatform] = useState<"both" | InfluencerPlatform>("both");
  const [limit, setLimit] = useState(String(DEFAULT_TIKTOK_SEARCH_LIMIT));
  const [submitting, startSubmit] = useTransition();

  const parsedTerms = parseDiscoveryTerms(terms);
  const tooManyTerms = parsedTerms.length > MAX_DISCOVERY_TERMS;
  const parsedLimit = Number.parseInt(limit, 10);
  const validLimit =
    Number.isFinite(parsedLimit) &&
    parsedLimit >= 1 &&
    parsedLimit <= MAX_TIKTOK_SEARCH_LIMIT;

  // Perkiraan kasar volume scrape — pengendali biaya modul ini, jadi lebih baik
  // terlihat sebelum tombol ditekan daripada muncul di tagihan Apify.
  const platformCount = platform === "both" ? 2 : 1;
  const estimatedPosts =
    validLimit && parsedTerms.length > 0 && !tooManyTerms
      ? parsedTerms.length * platformCount * parsedLimit
      : null;

  function submit() {
    if (parsedTerms.length === 0) {
      toast.error("Isi minimal satu hashtag atau kata kunci.");
      return;
    }
    if (tooManyTerms) {
      toast.error(
        `Maksimal ${MAX_DISCOVERY_TERMS} kata kunci per crawl — Anda mengisi ${parsedTerms.length}. Pecah jadi beberapa crawl.`,
      );
      return;
    }

    startSubmit(async () => {
      try {
        await startInfluencerDiscovery({
          terms: parsedTerms,
          platforms: platform === "both" ? [] : [platform],
          searchLimit: validLimit ? parsedLimit : DEFAULT_TIKTOK_SEARCH_LIMIT,
        });
        toast.success(
          "Crawl dimulai — hasilnya muncul di daftar beberapa menit lagi.",
        );
        setTerms("");
        onOpenChange(false);
        onStarted();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Crawl gagal dimulai."));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_12%,transparent)] text-[var(--lab-accent,var(--primary))]">
              <Radar className="size-5" aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <DialogTitle>Sisir hashtag untuk menemukan kreator</DialogTitle>
              <DialogDescription>
                Sistem menarik post terbaru dari hashtag yang Anda isi,
                mengambil pemilik akunnya, lalu mengukur follower dan engagement
                mereka secara otomatis.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="radar-terms">Hashtag / kata kunci</Label>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  tooManyTerms
                    ? "font-semibold text-rose-600 dark:text-rose-400"
                    : "text-muted-foreground",
                )}
              >
                {parsedTerms.length}/{MAX_DISCOVERY_TERMS}
              </span>
            </div>
            <Input
              id="radar-terms"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="#skincarelokal, #reviewskincare"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !submitting) submit();
              }}
            />
            {parsedTerms.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {parsedTerms.map((t, i) => (
                  <span
                    key={t}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[11px] font-medium",
                      i < MAX_DISCOVERY_TERMS
                        ? "bg-muted text-foreground"
                        : "bg-rose-500/10 text-rose-700 line-through dark:text-rose-300",
                    )}
                  >
                    {termChipLabel(t)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">
                Pisahkan dengan koma atau baris baru. Tanda # boleh ditulis atau
                tidak.
              </p>
            )}
            {tooManyTerms && (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                Maksimal {MAX_DISCOVERY_TERMS} kata kunci per crawl. Pecah jadi
                beberapa crawl agar tidak ada yang diam-diam tidak dicari.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="radar-platform">Platform</Label>
            <Select
              value={platform}
              items={CRAWL_PLATFORM_ITEMS}
              onValueChange={(v) =>
                setPlatform((v as typeof platform | null) ?? "both")
              }
            >
              <SelectTrigger id="radar-platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRAWL_PLATFORM_ITEMS.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="radar-limit">Post per platform</Label>
            <Input
              id="radar-limit"
              type="number"
              min={1}
              max={MAX_TIKTOK_SEARCH_LIMIT}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              aria-invalid={!validLimit}
            />
            <p className="text-muted-foreground text-xs">
              Makin besar makin banyak kreator ditemukan — dan makin besar pula
              biaya scraping-nya. {DEFAULT_TIKTOK_SEARCH_LIMIT} biasanya
              menghasilkan 15–20 kreator per hashtag. Maksimal{" "}
              {MAX_TIKTOK_SEARCH_LIMIT}.
            </p>
          </div>

          {estimatedPosts !== null && (
            <p className="border-border/60 bg-muted/30 text-muted-foreground rounded-lg border px-3 py-2 text-xs leading-relaxed">
              Perkiraan volume:{" "}
              <strong className="text-foreground">
                {num(estimatedPosts)} post
              </strong>{" "}
              disisir ({parsedTerms.length} kata kunci ×{" "}
              {platformCount === 2 ? "2 platform" : "1 platform"} ×{" "}
              {num(parsedLimit)} post).
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            onClick={submit}
            disabled={submitting || parsedTerms.length === 0 || tooManyTerms}
          >
            {submitting && (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            )}
            Mulai crawl
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
