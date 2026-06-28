import Link from "next/link";
import { Lightbulb, MessageSquareQuote, Hash, Sparkles, Users } from "lucide-react";
import {
  ResearchHubPageHeader,
  ResearchHubPageShell,
  ResearchHubSection,
  hub,
} from "@/components/research-hub/research-hub-primitives";
import { hrefWithBrand } from "@/components/content-studio/content-studio-module-nav";
import { cn } from "@/lib/utils";

export default async function ContentStudioOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string }>;
}) {
  const { brandId } = await searchParams;
  const scope = brandId ?? null;

  return (
    <ResearchHubPageShell>
      <ResearchHubPageHeader
        icon={Sparkles}
        eyebrow="Content & Creator Studio"
        title="Bikin konten yang berakar data nyata brand-mu"
        description="Ide, caption, hashtag, sampai pemilihan kreator — semuanya digrounding ke sinyal asli (Review Intel, Ad Library, Trend Radar, Brand Voice), bukan tebakan generic."
      />

      <ResearchHubSection
        title="Mulai dari sini"
        description="Fase 1 — Ideation. Fitur lain menyusul setelah kualitas ini terbukti."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href={hrefWithBrand("/content-studio/ideas", scope)}
            className={cn(hub.card, hub.cardHover, "block")}
          >
            <div className={hub.cardBody}>
              <span className="bg-primary/10 text-primary mb-3 flex size-10 items-center justify-center rounded-xl">
                <Lightbulb className="size-5" aria-hidden />
              </span>
              <p className="text-foreground font-semibold">Content Ideas</p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                Ide konten ter-ranking dengan citation ke keluhan customer asli,
                hook iklan kompetitor yang menang, dan tren kategori. Dinilai
                self-critique biar tidak klise.
              </p>
              <span className="text-primary mt-3 inline-block text-sm font-medium">
                Buka →
              </span>
            </div>
          </Link>

          <div className={cn(hub.card, "block opacity-70")}>
            <div className={hub.cardBody}>
              <div className="mb-3 flex gap-2">
                {[MessageSquareQuote, Hash, Users].map((Icon, i) => (
                  <span
                    key={i}
                    className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-xl"
                  >
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                ))}
              </div>
              <p className="text-foreground font-semibold">
                Caption · Hashtag · Creator{" "}
                <span className="text-muted-foreground text-xs font-normal">
                  (segera)
                </span>
              </p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                Caption generator (brand voice), hashtag research (data scrape
                nyata), dan discovery kreator/affiliator dari sinyal publik —
                dibangun setelah Content Ideas terbukti dipakai.
              </p>
            </div>
          </div>
        </div>
      </ResearchHubSection>

      <ResearchHubSection
        title="Kenapa ini beda dari ChatGPT biasa"
        description="Tiga mekanisme anti-generic yang bikin output layak dipakai."
      >
        <ul className="grid gap-3 sm:grid-cols-3">
          {[
            {
              t: "Grounded + ber-citation",
              d: "Tiap ide menempelkan sinyal nyata yang mendasarinya, jadi bisa kamu verifikasi & percaya.",
            },
            {
              t: "Self-critique anti-klise",
              d: "AI menilai ketajaman tiap ide dan menulis ulang yang terlalu aman/generic.",
            },
            {
              t: "Belajar dari selera tim",
              d: "Ide yang kamu 👍 / tandai 'dipakai' jadi contoh untuk generasi berikutnya.",
            },
          ].map((x) => (
            <li key={x.t} className={hub.panel}>
              <p className="text-foreground text-sm font-semibold">{x.t}</p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {x.d}
              </p>
            </li>
          ))}
        </ul>
      </ResearchHubSection>
    </ResearchHubPageShell>
  );
}
