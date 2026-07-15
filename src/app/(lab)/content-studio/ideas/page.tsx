import Link from "next/link";
import { ArrowUpRight, Lightbulb } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ensureContentStudioPage } from "@/lib/content-studio/auth";
import {
  LabEmptyState,
  LabPageHeader,
  LabPageShell,
  lab,
} from "@/components/lab/lab-primitives";
import { hrefWithBrand } from "@/components/content-studio/content-studio-module-nav";
import { GROUNDING_SOURCE_LABELS } from "@/lib/content-studio/grounding";
import { IdeaSetStatusBadge, isIdeaSetBusy } from "./idea-status-badge";
import { IdeasCreateSection } from "./ideas-create-form";
import { cn } from "@/lib/utils";

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

export default async function ContentIdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string }>;
}) {
  await ensureContentStudioPage();
  const { brandId } = await searchParams;
  const scope = brandId ?? null;

  const sets = await prisma.contentStudioIdeaSet.findMany({
    where: scope ? { ownerBrandId: scope } : {},
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      topic: true,
      status: true,
      platforms: true,
      groundingSources: true,
      createdAt: true,
      _count: { select: { ideas: true } },
    },
  });

  const totalIdeas = sets.reduce((acc, s) => acc + s._count.ideas, 0);
  const readyCount = sets.filter((s) => s.status === "READY").length;
  const runningCount = sets.filter((s) => isIdeaSetBusy(s.status)).length;
  const failedCount = sets.filter((s) => s.status === "FAILED").length;

  return (
    <LabPageShell>
      <LabPageHeader
        icon={Lightbulb}
        eyebrow="Content & Creator Studio"
        title="Content"
        titleAccent="Ideas"
        description="Ide konten ter-ranking yang berakar sinyal nyata brand (Review Intel, Ad Library, Trend Radar, Brand Voice) + dinilai self-critique agar tidak generic."
      />

      {/* Strip bento ringkasan */}
      {sets.length > 0 ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          {/* Hero amber: total ide */}
          <div className="bento-tile border-transparent bg-amber-500 shadow-md shadow-amber-500/25 dark:bg-amber-400">
            <span className="text-[11.5px] font-semibold text-amber-100 dark:text-amber-950/70">
              Total ide
            </span>
            <span className="bento-value text-white dark:text-amber-950">
              {totalIdeas}
            </span>
            <span className="text-[11px] font-medium text-amber-100/90 dark:text-amber-900/80">
              grounded sinyal nyata, bukan tebakan
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Total set</span>
            <span className="bento-value">{sets.length}</span>
            <span className="text-muted-foreground text-[11px] font-medium">
              brainstorm yang pernah dibuat
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Siap dipakai</span>
            <span className="bento-value text-emerald-600 dark:text-emerald-400">
              {readyCount}
              <span className="text-muted-foreground/60 text-lg font-bold">
                {" "}
                / {sets.length}
              </span>
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              set selesai digenerate
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Sedang berjalan</span>
            <span className="bento-value">{runningCount}</span>
            <span className="text-muted-foreground text-[11px] font-medium">
              {failedCount > 0
                ? `digenerate di background · ${failedCount} gagal`
                : "digenerate di background"}
            </span>
          </div>
        </div>
      ) : null}

      <IdeasCreateSection
        brandId={scope}
        setCount={sets.length}
        totalIdeas={totalIdeas}
      >
        {sets.length === 0 ? (
          <LabEmptyState
            icon={Lightbulb}
            title="Belum ada ide"
            description="Buat set ide pertama lewat form di atas. Semakin lengkap data brand (review, iklan kompetitor, tren), semakin tajam idenya."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sets.map((s) => (
              <li key={s.id} className="min-w-0">
                <Link
                  href={hrefWithBrand(`/content-studio/ideas/${s.id}`, scope)}
                  className={cn(
                    lab.card,
                    lab.cardHover,
                    "group flex h-full flex-col p-0",
                  )}
                >
                  <div className="flex flex-1 flex-col gap-4 p-5 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          aria-hidden
                        >
                          <Lightbulb className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                            <span className="truncate">{s.name}</span>
                            <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {s.topic}
                          </p>
                        </div>
                      </div>
                      <IdeaSetStatusBadge status={s.status} />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <CardStat label="Ide" value={s._count.ideas} />
                      <CardStat
                        label="Grounding"
                        value={
                          s.groundingSources.length > 0
                            ? `${s.groundingSources.length} sumber`
                            : "—"
                        }
                      />
                      <CardStat
                        label="Dibuat"
                        value={s.createdAt.toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                        })}
                      />
                    </div>

                    {s.groundingSources.length > 0 ? (
                      <p className="text-muted-foreground truncate text-xs">
                        Berakar pada{" "}
                        <span className="text-foreground font-medium">
                          {s.groundingSources
                            .map((g) => GROUNDING_SOURCE_LABELS[g] ?? g)
                            .join(", ")}
                        </span>
                      </p>
                    ) : null}
                  </div>

                  <div className="border-border/60 flex items-center gap-1.5 overflow-hidden border-t px-5 py-2.5">
                    {s.platforms.length > 0 ? (
                      s.platforms.map((p) => (
                        <span
                          key={p}
                          className="bg-muted/70 text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                        >
                          {p}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-[11px]">
                        Semua platform
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </IdeasCreateSection>
    </LabPageShell>
  );
}
