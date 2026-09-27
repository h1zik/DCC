"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveKolPlatformSettings } from "@/actions/kol-posts";
import { PlatformMark } from "@/components/kol-hub/kol-badges";
import { Field, RupiahInput } from "@/components/kol-hub/kol-fields";
import { LabCard, lab } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { actionErrorMessage } from "@/lib/action-error-message";
import { rupiah } from "@/lib/kol/format";
import { computeRateBand } from "@/lib/kol/rate-card";
import { PLATFORM_LABEL, TIER_LABEL } from "@/lib/kol/labels";
import { formatWibDateTime } from "@/lib/kol/time";
import { cn } from "@/lib/utils";

type Tier = "NANO" | "MICRO" | "MID" | "MACRO" | "MEGA";
const TIERS: Tier[] = ["NANO", "MICRO", "MID", "MACRO", "MEGA"];
const TIER_RANGE: Record<Tier, string> = {
  NANO: "< 10rb follower",
  MICRO: "10rb–100rb",
  MID: "100rb–500rb",
  MACRO: "500rb–1jt",
  MEGA: "> 1jt",
};

type Settings = {
  configs: Record<
    "INSTAGRAM" | "TIKTOK",
    { floorPct: number; ceilingPct: number; fypThreshold: number; trackingDays: number }
  >;
  cpm: Record<"INSTAGRAM" | "TIKTOK", Record<Tier, number>>;
};

function PlatformCard({
  platform,
  settings,
  canEdit,
}: {
  platform: "INSTAGRAM" | "TIKTOK";
  settings: Settings;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const cfg = settings.configs[platform];
  const [v, setV] = useState({
    floorPct: String(cfg.floorPct),
    ceilingPct: String(cfg.ceilingPct),
    fypThreshold: String(cfg.fypThreshold),
    trackingDays: String(cfg.trackingDays),
    cpm: Object.fromEntries(TIERS.map((t) => [t, String(settings.cpm[platform][t])])) as Record<Tier, string>,
  });
  const example = computeRateBand(
    50_000,
    Number(v.cpm.MICRO) || 0,
    Number(v.floorPct) || 0,
    Number(v.ceilingPct) || 0,
  );

  return (
    <LabCard className="flex flex-col gap-5 p-5">
      <h2 className={cn(lab.sectionTitle, "flex items-center gap-2")}>
        <PlatformMark platform={platform} className="size-6" />
        {PLATFORM_LABEL[platform]}
      </h2>

      <fieldset disabled={!canEdit || pending} className="grid gap-5">
        <div>
          <p className="mb-2 text-xs font-medium">CPM acuan per tier</p>
          <div className="grid gap-2">
            {TIERS.map((t) => (
              <div key={t} className="grid grid-cols-[minmax(0,1fr)_160px] items-center gap-3">
                <span className="text-sm">
                  {TIER_LABEL[t]}{" "}
                  <span className="text-muted-foreground text-xs">{TIER_RANGE[t]}</span>
                </span>
                <RupiahInput
                  ariaLabel={`CPM ${TIER_LABEL[t]} ${PLATFORM_LABEL[platform]}`}
                  value={v.cpm[t]}
                  onChange={(raw) => setV({ ...v, cpm: { ...v.cpm, [t]: raw } })}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Batas bawah (%)" hint="Di bawahnya = Good deal (50–95).">
            <Input
              type="number"
              min={50}
              max={95}
              value={v.floorPct}
              onChange={(e) => setV({ ...v, floorPct: e.target.value })}
            />
          </Field>
          <Field label="Batas atas (%)" hint="Di atasnya = Kemahalan (105–200).">
            <Input
              type="number"
              min={105}
              max={200}
              value={v.ceilingPct}
              onChange={(e) => setV({ ...v, ceilingPct: e.target.value })}
            />
          </Field>
          <Field label="Ambang FYP (views)" hint="Konten dianggap masuk FYP bila views melewati angka ini.">
            <Input
              type="number"
              min={10000}
              step={10000}
              value={v.fypThreshold}
              onChange={(e) => setV({ ...v, fypThreshold: e.target.value })}
            />
          </Field>
          <Field label="Lama pelacakan (hari)" hint="Metrik diambil harian selama ini setelah tayang.">
            <Input
              type="number"
              min={3}
              max={90}
              value={v.trackingDays}
              onChange={(e) => setV({ ...v, trackingDays: e.target.value })}
            />
          </Field>
        </div>
      </fieldset>

      {example ? (
        <p className={cn(lab.nestedPanel, "text-xs leading-relaxed")}>
          Contoh: KOL Micro dengan median 50rb views → harga wajar{" "}
          <span className="font-semibold">{rupiah(example.fair)}</span>, rentang{" "}
          {rupiah(example.floor)} – {rupiah(example.ceiling)}.
        </p>
      ) : null}

      {canEdit ? (
        <Button
          className="self-end"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await saveKolPlatformSettings({
                  platform,
                  floorPct: Number(v.floorPct),
                  ceilingPct: Number(v.ceilingPct),
                  fypThreshold: Number(v.fypThreshold),
                  trackingDays: Number(v.trackingDays),
                  cpm: Object.fromEntries(TIERS.map((t) => [t, Number(v.cpm[t])])) as Record<Tier, number>,
                });
                toast.success(`Pengaturan ${PLATFORM_LABEL[platform]} disimpan.`);
                router.refresh();
              } catch (err) {
                toast.error(actionErrorMessage(err, "Gagal menyimpan pengaturan."));
              }
            })
          }
        >
          Simpan {PLATFORM_LABEL[platform]}
        </Button>
      ) : null}
    </LabCard>
  );
}

export function RateCardClient({
  settings,
  canEdit,
  lastRun,
}: {
  settings: Settings;
  canEdit: boolean;
  lastRun: {
    status: string;
    createdAt: string;
    updated: number;
    missing: number;
    error: string | null;
  } | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      {!canEdit ? (
        <p className={cn(lab.nestedPanel, "text-muted-foreground text-sm")}>
          Hanya approver KOL Hub yang bisa mengubah pengaturan ini.
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <PlatformCard platform="TIKTOK" settings={settings} canEdit={canEdit} />
        <PlatformCard platform="INSTAGRAM" settings={settings} canEdit={canEdit} />
      </div>
      <p className="text-muted-foreground text-xs">
        {lastRun
          ? `Sinkronisasi metrik terakhir ${formatWibDateTime(lastRun.createdAt)}: ${lastRun.updated} post diperbarui${lastRun.missing ? `, ${lastRun.missing} tidak terbaca` : ""}${lastRun.error ? ` — ${lastRun.error}` : ""}.`
          : "Belum pernah ada sinkronisasi metrik post."}{" "}
        Median views diambil dari audit influencer terbaru (atau pengukuran ringan KOL Radar).
      </p>
    </div>
  );
}
