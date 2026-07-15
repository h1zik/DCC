import Link from "next/link";
import {
  ArrowUpRight,
  CalendarRange,
  Hash,
  Lightbulb,
  MessageSquareQuote,
  Users,
} from "lucide-react";
import { ContentStudioStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LabPageShell, LabSection, lab } from "@/components/lab/lab-primitives";
import { hrefWithBrand } from "@/components/content-studio/content-studio-module-nav";
import { cn } from "@/lib/utils";

export default async function ContentStudioOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string }>;
}) {
  const { brandId } = await searchParams;
  const scope = brandId ?? null;
  const brandWhere = scope ? { ownerBrandId: scope } : {};

  const [setCount, readySetCount, ideaCount, usedIdeaCount, recentSets] =
    await Promise.all([
      prisma.contentStudioIdeaSet.count({ where: brandWhere }),
      prisma.contentStudioIdeaSet.count({
        where: { ...brandWhere, status: ContentStudioStatus.READY },
      }),
      prisma.contentStudioIdea.count({
        where: scope ? { ownerBrandId: scope } : {},
      }),
      prisma.contentStudioIdea.count({
        where: { ...(scope ? { ownerBrandId: scope } : {}), used: true },
      }),
      prisma.contentStudioIdeaSet.findMany({
        where: brandWhere,
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          topic: true,
          status: true,
          createdAt: true,
          _count: { select: { ideas: true } },
        },
      }),
    ]);

  const statusLabel: Record<ContentStudioStatus, string> = {
    PENDING: "Menunggu",
    COLLECTING: "Mengumpulkan",
    ANALYZING: "Menganalisis",
    READY: "Siap",
    FAILED: "Gagal",
  };

  return (
    <LabPageShell className="gap-6">
      {/* Header bento: display besar. */}
      <header className={cn(lab.entrance, "space-y-1.5")}>
        <h1 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl">
          Content <span className="text-primary">Studio</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed sm:text-[15px]">
          Ide, caption, hashtag, sampai pemilihan kreator — semuanya
          digrounding ke sinyal asli (Review Intel, Ad Library, Trend Radar,
          Brand Voice), bukan tebakan generic.
        </p>
      </header>

      {/* Papan bento metrik */}
      <div
        className={cn(
          lab.entrance,
          "grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 md:grid-cols-4",
        )}
      >
        {/* Hero amber: CTA mulai brainstorm */}
        <Link
          href={hrefWithBrand("/content-studio/ideas", scope)}
          className="bento-tile row-span-2 border-transparent bg-amber-500 shadow-md shadow-amber-500/25 dark:bg-amber-400"
        >
          <span className="text-[11.5px] font-semibold text-amber-100 dark:text-amber-950/70">
            Mulai di sini
          </span>
          <span className="text-2xl font-extrabold leading-tight tracking-tight text-white dark:text-amber-950">
            Brainstorm ide konten grounded data
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-100 dark:text-amber-900">
            Buka Content Ideas <ArrowUpRight className="size-3.5" />
          </span>
        </Link>

        <div className="bento-tile">
          <span className="bento-label">Set ide</span>
          <span className="bento-value">
            {setCount}
            <span className="text-muted-foreground/60 text-lg font-bold">
              {" "}
              · {readySetCount} siap
            </span>
          </span>
        </div>

        <div className="bento-tile">
          <span className="bento-label">Total ide</span>
          <span className="bento-value">{ideaCount}</span>
        </div>

        <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
          <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
            Ide dipakai tim
          </span>
          <span className="bento-value text-amber-900 dark:text-amber-300">
            {usedIdeaCount}
          </span>
        </div>

        <div className="bento-tile">
          <span className="bento-label">Adopsi</span>
          <span className="bento-value">
            {ideaCount > 0 ? Math.round((usedIdeaCount / ideaCount) * 100) : 0}
            <span className="text-muted-foreground/60 text-lg font-bold">
              %
            </span>
          </span>
        </div>
      </div>

      {/* Set terbaru + roadmap */}
      <div className={cn(lab.entrance, "grid gap-3 lg:grid-cols-2")}>
        <div className="bento-tile justify-start gap-3">
          <div className="flex items-center justify-between">
            <span className="bento-label">Set ide terbaru</span>
            <Link
              href={hrefWithBrand("/content-studio/ideas", scope)}
              className="text-primary text-xs font-semibold hover:underline"
            >
              Semua set →
            </Link>
          </div>
          {recentSets.length === 0 ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Belum ada set ide. Mulai brainstorm pertama dari tile amber di
              atas — hasilnya muncul di sini.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {recentSets.map((s) => (
                <Link
                  key={s.id}
                  href={hrefWithBrand(`/content-studio/ideas/${s.id}`, scope)}
                  className="border-border/60 bg-muted/40 hover:bg-muted/70 flex items-center gap-3 rounded-xl border p-2.5 transition-colors"
                >
                  <span className="bg-amber-500/15 text-amber-700 dark:text-amber-300 flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <Lightbulb className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-foreground block truncate text-sm font-medium">
                      {s.name}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {s.topic} · {s._count.ideas} ide
                    </span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-[11px] font-semibold">
                    {statusLabel[s.status]}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bento-tile justify-start gap-3">
          <span className="bento-label">Kenapa beda dari ChatGPT biasa</span>
          <ul className="flex flex-col gap-2.5">
            {[
              {
                t: "Grounded + ber-citation",
                d: "Tiap ide menempelkan sinyal nyata yang mendasarinya — bisa diverifikasi.",
              },
              {
                t: "Self-critique anti-klise",
                d: "AI menilai ketajaman tiap ide dan menulis ulang yang terlalu generic.",
              },
              {
                t: "Belajar dari selera tim",
                d: "Ide yang di-👍 / dipakai jadi contoh untuk generasi berikutnya.",
              },
            ].map((x) => (
              <li key={x.t} className="text-sm">
                <span className="text-foreground font-semibold">{x.t}</span>
                <span className="text-muted-foreground"> — {x.d}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Roadmap: segera hadir */}
      <LabSection
        title="Segera hadir"
        description="Dibangun setelah Content Ideas terbukti dipakai tim."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: MessageSquareQuote,
              t: "Caption Generator",
              d: "Caption per platform dengan brand voice asli dari Brand Hub.",
            },
            {
              icon: Hash,
              t: "Hashtag Research",
              d: "Riset hashtag dari data scrape nyata, bukan daftar statis.",
            },
            {
              icon: Users,
              t: "Creator Discovery",
              d: "Temukan kreator/affiliator dari sinyal publik yang relevan.",
            },
          ].map((x) => (
            <div
              key={x.t}
              className="border-border/70 bg-card/40 flex flex-col gap-2 rounded-2xl border border-dashed p-5"
            >
              <span className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-xl">
                <x.icon className="size-4.5" aria-hidden />
              </span>
              <p className="text-foreground text-sm font-semibold">
                {x.t}{" "}
                <span className="text-muted-foreground text-xs font-normal">
                  (segera)
                </span>
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {x.d}
              </p>
            </div>
          ))}
        </div>
      </LabSection>

      <p className="text-muted-foreground/70 flex items-center gap-1.5 text-xs">
        <CalendarRange className="size-3.5" />
        Fase 1 — Ideation. Data metrik dihitung ulang setiap halaman dibuka.
      </p>
    </LabPageShell>
  );
}
