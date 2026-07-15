"use client";

import {
  Frown,
  Quote,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AudiencePersonaView = {
  name: string;
  archetype?: string;
  demographics?: string;
  painPoints?: string[];
  hopes?: string[];
  motivations?: {
    functional?: string[];
    emotional?: string[];
    social?: string[];
  } | null;
  habits?: {
    channels?: string[];
    triggers?: string[];
    buyingBehavior?: string;
    decisionFactors?: string[];
  } | null;
  representativeQuotes?: { text: string; source?: string }[];
  shareOfAudience?: string;
};

function Chips({ items }: { items?: string[] }) {
  if (!items || items.length === 0)
    return <p className="text-muted-foreground text-xs italic">—</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span
          key={i}
          className="bg-card text-foreground rounded-full px-2.5 py-1 text-xs shadow-sm"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase tracking-wide">
      {children}
    </p>
  );
}

/** Panel dimensi persona — pastel bento per dimensi (senada papan metrik SEO). */
function Dimension({
  icon: Icon,
  label,
  children,
  tone,
}: {
  icon: typeof Target;
  label: string;
  children: React.ReactNode;
  tone: { panel: string; title: string };
}) {
  return (
    <div className={cn("rounded-xl p-3.5", tone.panel)}>
      <p className={cn("mb-2 flex items-center gap-1.5 text-xs font-bold", tone.title)}>
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      {children}
    </div>
  );
}

const TONES = {
  pain: {
    panel: "bg-[#fbdcd7] dark:bg-rose-400/10",
    title: "text-rose-900 dark:text-rose-300",
  },
  hope: {
    panel: "bg-emerald-500/10 dark:bg-emerald-400/10",
    title: "text-emerald-800 dark:text-emerald-300",
  },
  motivation: {
    panel: "bg-[#ffedcd] dark:bg-amber-400/10",
    title: "text-amber-900 dark:text-amber-300",
  },
  habit: {
    panel: "bg-[#e9e3f9] dark:bg-violet-400/10",
    title: "text-violet-900 dark:text-violet-300",
  },
} as const;

export function BrandAudiencePersonaCard({
  persona,
}: {
  persona: AudiencePersonaView;
}) {
  const m = persona.motivations ?? {};
  const h = persona.habits ?? {};

  return (
    <article className="bento-tile justify-start gap-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/12 text-pink-700 dark:text-pink-300">
            <Users className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-bold tracking-tight">
              {persona.name}
            </h3>
            {persona.archetype ? (
              <p className="text-muted-foreground text-xs">{persona.archetype}</p>
            ) : null}
          </div>
        </div>
        {persona.shareOfAudience ? (
          <Badge
            variant="outline"
            className="text-xs"
            title="Estimasi AI — tidak ada data ukuran audiens yang diukur. Indikatif saja."
          >
            ~{persona.shareOfAudience} <span className="ml-1 opacity-60">est. AI</span>
          </Badge>
        ) : null}
      </header>

      {persona.demographics ? (
        <p
          className="text-muted-foreground text-sm leading-relaxed"
          title="Demografi diperkirakan AI dari sinyal kualitatif (review/sosial) — bukan data demografi terukur."
        >
          {persona.demographics}{" "}
          <span className="text-[11px] opacity-70">(perkiraan AI)</span>
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Dimension icon={Frown} label="Pain Point" tone={TONES.pain}>
          <Chips items={persona.painPoints} />
        </Dimension>
        <Dimension icon={Sparkles} label="Harapan" tone={TONES.hope}>
          <Chips items={persona.hopes} />
        </Dimension>
      </div>

      <Dimension icon={Zap} label="Motivasi" tone={TONES.motivation}>
        <div className="space-y-2.5">
          <div>
            <SubLabel>Fungsional</SubLabel>
            <Chips items={m.functional} />
          </div>
          <div>
            <SubLabel>Emosional</SubLabel>
            <Chips items={m.emotional} />
          </div>
          <div>
            <SubLabel>Sosial</SubLabel>
            <Chips items={m.social} />
          </div>
        </div>
      </Dimension>

      <Dimension icon={Target} label="Kebiasaan Beli" tone={TONES.habit}>
        <div className="space-y-2.5">
          {h.buyingBehavior ? (
            <p className="text-sm leading-relaxed">{h.buyingBehavior}</p>
          ) : null}
          <div>
            <SubLabel>Kanal</SubLabel>
            <Chips items={h.channels} />
          </div>
          <div>
            <SubLabel>Pemicu</SubLabel>
            <Chips items={h.triggers} />
          </div>
          <div>
            <SubLabel>Faktor Keputusan</SubLabel>
            <Chips items={h.decisionFactors} />
          </div>
        </div>
      </Dimension>

      {persona.representativeQuotes && persona.representativeQuotes.length > 0 ? (
        <div className="space-y-2">
          <SubLabel>Kutipan Konsumen</SubLabel>
          {persona.representativeQuotes.map((q, i) => (
            <blockquote
              key={i}
              className="border-border/60 bg-muted/20 text-muted-foreground flex gap-2 rounded-r-lg border-l-2 py-1.5 pl-3 pr-2 text-sm italic"
            >
              <Quote className="size-3.5 shrink-0 translate-y-0.5" aria-hidden />
              <span>
                {q.text}
                {q.source ? (
                  <span className="text-muted-foreground/70 ml-1 text-xs not-italic">
                    · {q.source}
                  </span>
                ) : null}
              </span>
            </blockquote>
          ))}
        </div>
      ) : null}
    </article>
  );
}
