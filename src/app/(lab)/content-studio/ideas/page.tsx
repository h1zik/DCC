import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ensureContentStudioPage } from "@/lib/content-studio/auth";
import {
  LabEmptyState,
  LabPageHeader,
  LabPageShell,
  LabSection,
  lab,
} from "@/components/lab/lab-primitives";
import { hrefWithBrand } from "@/components/content-studio/content-studio-module-nav";
import { GROUNDING_SOURCE_LABELS } from "@/lib/content-studio/grounding";
import { IdeaSetStatusBadge } from "./idea-status-badge";
import { IdeasCreateForm } from "./ideas-create-form";
import { cn } from "@/lib/utils";

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

  return (
    <LabPageShell>
      <LabPageHeader
        icon={Lightbulb}
        eyebrow="Content & Creator Studio"
        title="Content Ideas"
        description="Ide konten ter-ranking yang berakar sinyal nyata brand (Review Intel, Ad Library, Trend Radar, Brand Voice) + dinilai self-critique agar tidak generic."
      />

      <LabSection
        title="Generate ide baru"
        description="Isi topik/kampanye, pilih platform. Ide digenerate di background lalu muncul di detail."
      >
        <div className={cn(lab.panel)}>
          <IdeasCreateForm brandId={scope} />
        </div>
      </LabSection>

      <LabSection title="Riwayat" description={`${sets.length} set ide`}>
        {sets.length === 0 ? (
          <LabEmptyState
            icon={Lightbulb}
            title="Belum ada ide"
            description="Buat set ide pertama lewat form di atas. Semakin lengkap data brand (review, iklan kompetitor, tren), semakin tajam idenya."
          />
        ) : (
          <ul className="grid gap-3">
            {sets.map((s) => (
              <li key={s.id}>
                <Link
                  href={hrefWithBrand(`/content-studio/ideas/${s.id}`, scope)}
                  className={cn(lab.card, lab.cardHover, "block")}
                >
                  <div className="flex items-start justify-between gap-4 p-4 sm:p-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-foreground truncate font-semibold">
                          {s.name}
                        </p>
                        <IdeaSetStatusBadge status={s.status} />
                      </div>
                      <p className="text-muted-foreground mt-1 line-clamp-1 text-sm">
                        {s.topic}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{s._count.ideas} ide</span>
                        {s.platforms.length > 0 ? (
                          <span>· {s.platforms.join(", ")}</span>
                        ) : null}
                        {s.groundingSources.length > 0 ? (
                          <span>
                            · grounding:{" "}
                            {s.groundingSources
                              .map((g) => GROUNDING_SOURCE_LABELS[g] ?? g)
                              .join(", ")}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {s.createdAt.toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </LabSection>
    </LabPageShell>
  );
}
