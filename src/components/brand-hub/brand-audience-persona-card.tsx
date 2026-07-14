"use client";

import {
  Frown,
  Quote,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { lab } from "@/components/lab/lab-primitives";
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
          className="bg-muted/60 text-foreground rounded-md px-2 py-0.5 text-xs"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function Dimension({
  icon: Icon,
  label,
  children,
  accent,
}: {
  icon: typeof Target;
  label: string;
  children: React.ReactNode;
  accent: string;
}) {
  return (
    <div className={cn(lab.nestedPanel, "border-l-2", accent)}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      {children}
    </div>
  );
}

export function BrandAudiencePersonaCard({
  persona,
}: {
  persona: AudiencePersonaView;
}) {
  const m = persona.motivations ?? {};
  const h = persona.habits ?? {};

  return (
    <article className={cn(lab.card, lab.cardBody, "flex flex-col gap-4")}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <span className="bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_10%,transparent)] text-[var(--lab-accent,var(--primary))] flex size-10 shrink-0 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--lab-accent,var(--primary))_20%,transparent)]">
            <Users className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-tight">
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
        <Dimension icon={Frown} label="Pain Point" accent="border-l-red-500">
          <Chips items={persona.painPoints} />
        </Dimension>
        <Dimension icon={Sparkles} label="Harapan" accent="border-l-emerald-500">
          <Chips items={persona.hopes} />
        </Dimension>
      </div>

      <Dimension icon={Zap} label="Motivasi" accent="border-l-amber-500">
        <div className="space-y-2">
          <div>
            <p className={lab.label}>Fungsional</p>
            <Chips items={m.functional} />
          </div>
          <div>
            <p className={lab.label}>Emosional</p>
            <Chips items={m.emotional} />
          </div>
          <div>
            <p className={lab.label}>Sosial</p>
            <Chips items={m.social} />
          </div>
        </div>
      </Dimension>

      <Dimension icon={Target} label="Kebiasaan Beli" accent="border-l-blue-500">
        <div className="space-y-2">
          {h.buyingBehavior ? (
            <p className="text-sm leading-relaxed">{h.buyingBehavior}</p>
          ) : null}
          <div>
            <p className={lab.label}>Kanal</p>
            <Chips items={h.channels} />
          </div>
          <div>
            <p className={lab.label}>Pemicu</p>
            <Chips items={h.triggers} />
          </div>
          <div>
            <p className={lab.label}>Faktor Keputusan</p>
            <Chips items={h.decisionFactors} />
          </div>
        </div>
      </Dimension>

      {persona.representativeQuotes && persona.representativeQuotes.length > 0 ? (
        <div className="space-y-2">
          <p className={lab.label}>Kutipan Konsumen</p>
          {persona.representativeQuotes.map((q, i) => (
            <blockquote
              key={i}
              className="border-border/60 text-muted-foreground flex gap-2 border-l-2 pl-3 text-sm italic"
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
