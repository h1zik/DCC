"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeoRankDevice } from "@prisma/client";
import {
  ArrowUpRight,
  Loader2,
  LineChart,
  Monitor,
  Plus,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { lab } from "@/components/lab/lab-primitives";
import { SeoSparkline } from "@/components/seo/seo-sparkline";
import { SEO_DEVICE_LABELS, formatRankPosition } from "@/lib/seo/labels";
import type { SelectItemDef } from "@/lib/select-option-items";
import { actionErrorMessage } from "@/lib/action-error-message";
import {
  createSeoRankProject,
  deleteSeoRankProject,
  toggleRankProjectActive,
} from "@/actions/seo-rank-tracker";
import { cn } from "@/lib/utils";

const DEVICE_ITEMS: SelectItemDef[] = Object.values(SeoRankDevice).map((d) => ({
  value: d,
  label: SEO_DEVICE_LABELS[d],
}));

export type RankProjectRow = {
  id: string;
  name: string;
  domain: string;
  device: SeoRankDevice;
  isActive: boolean;
  keywordCount: number;
  createdAt: string;
  visibility: number;
  avgPosition: number | null;
  top3: number;
  page1: number;
  moversUp: number;
  moversDown: number;
  bestKeyword: { keyword: string; position: number } | null;
  /** Posisi rata-rata per hari (30 hari) untuk sparkline kartu. */
  spark: number[];
};

export type RankPortfolioSummary = {
  totalProjects: number;
  activeProjects: number;
  totalKeywords: number;
  avgPosition: number | null;
  top3: number;
  page1: number;
  moversUp: number;
  moversDown: number;
};

function parseKeywords(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((k) => k.trim())
    .filter(Boolean);
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        active
          ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          active ? "bg-emerald-500" : "bg-muted-foreground/50",
        )}
      />
      {active ? "Aktif" : "Nonaktif"}
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

export function RankTrackerClient({
  projects,
  summary,
}: {
  projects: RankProjectRow[];
  summary: RankPortfolioSummary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(projects.length === 0);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [device, setDevice] = useState<SeoRankDevice>(SeoRankDevice.MOBILE);
  const [keywords, setKeywords] = useState("");

  const parsedCount = useMemo(() => parseKeywords(keywords).length, [keywords]);

  function handleCreate() {
    if (!name.trim() || !domain.trim()) {
      toast.error("Nama dan domain wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await createSeoRankProject({
          name: name.trim(),
          domain: domain.trim(),
          device,
          keywords: parseKeywords(keywords),
        });
        setName("");
        setDomain("");
        setKeywords("");
        setFormOpen(false);
        toast.success("Proyek dibuat — cek posisi awal berjalan di background.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat proyek."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteSeoRankProject(id);
        toast.success("Proyek dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  function handleToggle(id: string, next: boolean) {
    startTransition(async () => {
      try {
        await toggleRankProjectActive(id, next);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengubah status."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Ringkasan portofolio */}
      {projects.length > 0 ? (
        <div
          className={cn(
            lab.entrance,
            "grid grid-cols-2 gap-3 lg:grid-cols-4",
          )}
        >
          <div className="bento-tile border-transparent bg-teal-600 shadow-md shadow-teal-600/20 dark:bg-teal-500">
            <span className="text-[11.5px] font-semibold text-teal-100 dark:text-teal-950/70">
              Keyword dilacak
            </span>
            <span className="bento-value text-white dark:text-teal-950">
              {summary.totalKeywords}
            </span>
            <span className="text-[11px] font-medium text-teal-100/90 dark:text-teal-900/80">
              di {summary.activeProjects}/{summary.totalProjects} proyek aktif
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Posisi rata-rata</span>
            <span className="bento-value">
              {summary.avgPosition != null
                ? formatRankPosition(Math.round(summary.avgPosition))
                : "—"}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              semua keyword yang ranking
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Top 3 · Halaman 1</span>
            <span className="bento-value">
              {summary.top3}
              <span className="text-muted-foreground/60 text-lg font-bold">
                {" "}
                / {summary.page1}
              </span>
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              keyword di posisi teratas
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Perubahan terakhir</span>
            <span className="flex items-baseline gap-3">
              <span className="bento-value text-emerald-600 dark:text-emerald-400">
                ▲{summary.moversUp}
              </span>
              <span className="bento-value text-rose-600 dark:text-rose-400">
                ▼{summary.moversDown}
              </span>
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              vs cek sebelumnya
            </span>
          </div>
        </div>
      ) : null}

      {/* Header daftar proyek + toggle form */}
      <section className={cn(lab.section, lab.entrance)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={lab.sectionTitle}>Proyek rank tracking</h2>
            <p className={lab.sectionDesc}>
              {projects.length === 0
                ? "Mulai dengan proyek pertama Anda di bawah."
                : `${projects.length} proyek · ${summary.totalKeywords} keyword dilacak di Google.co.id.`}
            </p>
          </div>
          {projects.length > 0 ? (
            <Button
              variant={formOpen ? "outline" : "default"}
              onClick={() => setFormOpen((v) => !v)}
            >
              {formOpen ? <X /> : <Plus />}
              {formOpen ? "Tutup" : "Proyek baru"}
            </Button>
          ) : null}
        </div>

        {/* Form proyek baru (collapsible) */}
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
                Proyek baru
              </p>
              <p className="text-muted-foreground text-sm">
                Masukkan domain target dan keyword yang ingin dilacak posisinya
                di Google Indonesia.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>Nama proyek</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="mis. Brand Anda – Skincare"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Domain target</Label>
                <Input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="mis. brandanda.com"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Perangkat</Label>
                <Select
                  value={device}
                  items={DEVICE_ITEMS}
                  onValueChange={(v) => {
                    if (v) setDevice(v as SeoRankDevice);
                  }}
                >
                  <SelectTrigger>{SEO_DEVICE_LABELS[device]}</SelectTrigger>
                  <SelectContent>
                    {Object.values(SeoRankDevice).map((d) => (
                      <SelectItem key={d} value={d}>
                        {SEO_DEVICE_LABELS[d]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Keyword (satu per baris atau pisah koma)</Label>
              <Textarea
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder={"serum vitamin c\nmoisturizer untuk kulit berminyak"}
                disabled={pending}
                rows={3}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">
                {parsedCount > 0
                  ? `${parsedCount} keyword siap dilacak — posisi awal dicek otomatis.`
                  : "Keyword bisa ditambah kapan saja dari halaman proyek."}
              </p>
              <Button onClick={handleCreate} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Plus />}
                Buat proyek
              </Button>
            </div>
          </div>
        ) : null}

        {/* Kartu proyek */}
        {projects.length === 0 && !formOpen ? null : projects.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => {
              const DeviceIcon =
                p.device === SeoRankDevice.MOBILE ? Smartphone : Monitor;
              return (
                <div
                  key={p.id}
                  className={cn(lab.card, "group flex flex-col p-0")}
                >
                  <Link
                    href={`/seo/rank-tracker/${p.id}`}
                    className="flex flex-1 flex-col gap-4 p-5 pb-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="bg-primary/12 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl text-base font-extrabold uppercase"
                          aria-hidden
                        >
                          {p.name.trim().charAt(0) || "?"}
                        </span>
                        <div className="min-w-0">
                          <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                            <span className="truncate">{p.name}</span>
                            <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {p.domain}
                          </p>
                        </div>
                      </div>
                      <StatusDot active={p.isActive} />
                    </div>

                    {p.spark.length >= 2 ? (
                      <div className="text-primary">
                        <SeoSparkline
                          values={p.spark}
                          invert
                          className="h-10"
                        />
                        <p className="text-muted-foreground mt-1 text-[10px] font-medium">
                          Posisi rata-rata · 30 hari terakhir
                        </p>
                      </div>
                    ) : (
                      <div className="border-border/60 bg-muted/30 text-muted-foreground flex h-[3.25rem] items-center justify-center rounded-lg border border-dashed px-3 text-center text-[11px]">
                        Tren muncul setelah beberapa hari pelacakan
                      </div>
                    )}

                    <div className="grid grid-cols-4 gap-2">
                      <CardStat label="Visibility" value={`${p.visibility}%`} />
                      <CardStat
                        label="Rata-rata"
                        value={
                          p.avgPosition != null
                            ? formatRankPosition(Math.round(p.avgPosition))
                            : "—"
                        }
                      />
                      <CardStat label="Top 3" value={p.top3} />
                      <CardStat
                        label="Δ Posisi"
                        value={
                          p.moversUp === 0 && p.moversDown === 0 ? (
                            "—"
                          ) : (
                            <>
                              <span className="text-emerald-600 dark:text-emerald-400">
                                ▲{p.moversUp}
                              </span>{" "}
                              <span className="text-rose-600 dark:text-rose-400">
                                ▼{p.moversDown}
                              </span>
                            </>
                          )
                        }
                      />
                    </div>

                    {p.bestKeyword ? (
                      <p className="text-muted-foreground truncate text-xs">
                        Terbaik:{" "}
                        <span className="text-foreground font-medium">
                          “{p.bestKeyword.keyword}”
                        </span>{" "}
                        · {formatRankPosition(p.bestKeyword.position)}
                      </p>
                    ) : null}
                  </Link>

                  <div className="border-border/60 flex items-center justify-between gap-2 border-t px-3 py-2">
                    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                      <DeviceIcon className="size-3.5" aria-hidden />
                      {SEO_DEVICE_LABELS[p.device]} · {p.keywordCount} keyword
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(p.id, !p.isActive)}
                        disabled={pending}
                      >
                        {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(p.id)}
                        disabled={pending}
                        aria-label="Hapus proyek"
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border-border/70 bg-card/40 text-muted-foreground flex items-center gap-3 rounded-2xl border border-dashed p-5 text-sm">
            <LineChart className="text-primary size-5 shrink-0" />
            Posisi keyword dicek otomatis tiap hari — buat proyek pertama di
            atas untuk mulai melacak.
          </div>
        )}
      </section>
    </div>
  );
}
