"use client";

import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CAMPAIGN_STATUS_LABEL,
  CAMPAIGN_STATUS_ORDER,
} from "@/lib/room-calendar/campaign-ui";
import { CampaignSwatch } from "./calendar-parts";
import type { CalendarLayers } from "./calendar-prefs";

type LayerRow = {
  key: keyof CalendarLayers;
  label: string;
  hint: string;
};

/** Nyala/mati lapisan baca-saja + keterangan cara membaca kalender. */
export function CalendarLayersButton({
  layers,
  kolAvailable,
  contentCount,
  kolCount,
  onChange,
}: {
  layers: CalendarLayers;
  kolAvailable: boolean;
  contentCount: number;
  kolCount: number;
  onChange: (next: CalendarLayers) => void;
}) {
  const rows: LayerRow[] = [
    {
      key: "moments",
      label: "Momen dan libur",
      hint: "Tanggal merah, tanggal kembar, periode gajian",
    },
    {
      key: "content",
      label: "Posting Content Plan",
      hint:
        contentCount > 0
          ? `${contentCount} jadwal posting dari ruangan ini`
          : "Belum ada jadwal posting di ruangan ini",
    },
    ...(kolAvailable
      ? [
          {
            key: "kol" as const,
            label: "Jadwal KOL",
            hint:
              kolCount > 0
                ? `${kolCount} jadwal tayang untuk brand ruangan`
                : "Belum ada jadwal tayang untuk brand ruangan",
          },
        ]
      : []),
    {
      key: "loose",
      label: "Aktivitas tanpa campaign",
      hint: "Acara ruangan yang tidak terkait campaign",
    },
  ];
  const off = rows.filter((r) => !layers[r.key]).length;

  return (
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="outline" size="sm" className="gap-1.5" />}>
        <Layers className="size-3.5" aria-hidden />
        Lapisan
        {off > 0 ? (
          <span className="text-muted-foreground tabular-nums">
            {rows.length - off}/{rows.length}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-76 gap-3 p-3">
        <div className="space-y-2.5">
          {rows.map((r) => (
            <label key={r.key} className="flex cursor-pointer items-start gap-2.5">
              <Checkbox
                className="mt-0.5"
                checked={layers[r.key]}
                onCheckedChange={(v) => onChange({ ...layers, [r.key]: Boolean(v) })}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{r.label}</span>
                <span className="text-muted-foreground block text-xs">{r.hint}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="border-t pt-2.5">
          <p className="text-muted-foreground text-xs">
            Warna menandai campaign, pola pita menandai statusnya.
          </p>
          <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
            {CAMPAIGN_STATUS_ORDER.map((s) => (
              <li key={s} className="flex items-center gap-1.5 text-xs">
                <CampaignSwatch color="sky" status={s} />
                {CAMPAIGN_STATUS_LABEL[s]}
              </li>
            ))}
          </ul>
          {layers.moments ? (
            <p className="text-muted-foreground mt-2 text-xs">
              Tanda * berarti tanggal hari raya masih perkiraan sampai SKB libur nasional terbit.
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
