"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarRange, Megaphone, Plus } from "lucide-react";
import {
  CampaignDialog,
  EMPTY_CAMPAIGN,
  type CampaignFormValue,
} from "@/components/kol-hub/campaign-dialog";
import { BudgetMeter } from "@/components/kol-hub/budget-meter";
import { KolSelect } from "@/components/kol-hub/kol-fields";
import { useUrlFilters } from "@/components/kol-hub/use-url-filters";
import { LabCard, LabEmptyState, LabToolbar } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import { rupiahShort } from "@/lib/kol/format";
import type { CampaignRow } from "@/lib/kol/readers";
import { formatWibDate } from "@/lib/kol/time";

export function CampaignsClient({
  campaigns,
  brands,
  budgets,
  users,
}: {
  campaigns: CampaignRow[];
  brands: { id: string; name: string }[];
  budgets: { id: string; name: string; brandId: string; remaining: number }[];
  users: { id: string; name: string }[];
}) {
  const { get, set } = useUrlFilters();
  const [editing, setEditing] = useState<CampaignFormValue | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <LabToolbar>
        <KolSelect
          className="h-8 w-[200px] text-xs"
          ariaLabel="Filter brand"
          value={get("brand")}
          onChange={(v) => set({ brand: v })}
          emptyLabel="Semua brand"
          options={brands.map((b) => ({ value: b.id, label: b.name }))}
        />
        <div className="flex-1" />
        <Button size="sm" onClick={() => setEditing({ ...EMPTY_CAMPAIGN, brandId: get("brand") })}>
          <Plus />
          Campaign baru
        </Button>
      </LabToolbar>

      {campaigns.length === 0 ? (
        <LabEmptyState
          icon={Megaphone}
          title="Belum ada campaign"
          description="Buat campaign dulu — jadwal KOL selalu dikaitkan ke campaign dan budget-nya."
          action={
            <Button size="sm" onClick={() => setEditing({ ...EMPTY_CAMPAIGN })}>
              <Plus />
              Campaign baru
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {campaigns.map((c) => (
            <LabCard key={c.id} interactive className="flex flex-col gap-4 p-5">
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">{c.brandName}</p>
                <Link
                  href={`/kol-hub/campaigns/${c.id}`}
                  className="mt-0.5 block text-base font-semibold after:absolute after:inset-0 hover:underline"
                >
                  {c.title}
                </Link>
                {c.startDate || c.endDate ? (
                  <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                    <CalendarRange className="size-3.5" aria-hidden />
                    {c.startDate ? formatWibDate(c.startDate) : "…"} –{" "}
                    {c.endDate ? formatWibDate(c.endDate) : "…"}
                  </p>
                ) : null}
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Jadwal", value: c.scheduleCount },
                  { label: "Menunggu", value: c.pendingCount },
                  { label: "Tayang", value: c.postedCount },
                ].map((x) => (
                  <div key={x.label} className="bg-muted/40 rounded-lg py-1.5">
                    <dt className="text-muted-foreground text-[11px]">{x.label}</dt>
                    <dd className="text-sm font-semibold tabular-nums">{x.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-muted-foreground truncate">{c.budgetName}</span>
                  <span className="tabular-nums">Campaign ini {rupiahShort(c.committedSpend)}</span>
                </div>
                <BudgetMeter
                  beginning={c.budgetBeginning}
                  committed={c.budgetBeginning - c.budgetRemaining}
                  pending={0}
                  compact
                />
              </div>
              <div className="relative z-[1] mt-auto flex items-center justify-between text-xs">
                <span className="text-muted-foreground">PIC {c.picName ?? "—"}</span>
                <button
                  type="button"
                  className="font-medium text-[var(--lab-accent,var(--primary))] hover:underline"
                  onClick={() =>
                    setEditing({
                      id: c.id,
                      brandId: c.brandId,
                      budgetId: c.budgetId,
                      title: c.title,
                      description: c.description ?? "",
                      startDate: c.startDate ?? "",
                      endDate: c.endDate ?? "",
                      picUserId: c.picUserId ?? "",
                    })
                  }
                >
                  Ubah
                </button>
              </div>
            </LabCard>
          ))}
        </div>
      )}

      {editing ? (
        <CampaignDialog
          key={editing.id ?? "new"}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          initial={editing}
          brands={brands}
          budgets={budgets}
          users={users}
        />
      ) : null}
    </div>
  );
}
