import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, ClipboardList, Megaphone } from "lucide-react";
import { BudgetMeter } from "@/components/kol-hub/budget-meter";
import { KolBadge } from "@/components/kol-hub/kol-badges";
import { ScheduleTable } from "@/components/kol-hub/schedule-table";
import { LabDetailPage } from "@/components/lab/lab-module-page";
import { LabCard, LabEmptyState, lab } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import { rupiah } from "@/lib/kol/format";
import {
  listBrandOptions,
  listBudgets,
  listCampaigns,
  listSchedules,
  listUserOptions,
} from "@/lib/kol/readers";
import { formatWibDate } from "@/lib/kol/time";
import { cn } from "@/lib/utils";
import { CampaignDetailActions } from "./campaign-detail-client";

export const metadata: Metadata = { title: "Campaign · KOL Hub" };

export default async function KolCampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const [[c], schedules, brands, budgets, users] = await Promise.all([
    listCampaigns(null, { id: campaignId, includeArchived: true }),
    listSchedules({ campaignId }, 500),
    listBrandOptions(),
    listBudgets(),
    listUserOptions(),
  ]);
  if (!c) notFound();
  const budget = budgets.find((b) => b.id === c.budgetId);

  return (
    <LabDetailPage
      icon={Megaphone}
      backHref="/kol-hub/campaigns"
      title={c.title}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <span>{c.brandName}</span>
          {c.startDate || c.endDate ? (
            <span>
              · {c.startDate ? formatWibDate(c.startDate) : "…"} –{" "}
              {c.endDate ? formatWibDate(c.endDate) : "…"}
            </span>
          ) : null}
          {c.picName ? <span>· PIC {c.picName}</span> : null}
          {c.archived ? <KolBadge tone="muted">Diarsipkan</KolBadge> : null}
        </span>
      }
      right={
        c.archived ? null : (
          <>
            <Button size="sm" render={<Link href={`/kol-hub/schedules/new?campaign=${c.id}`} />}>
              <CalendarPlus />
              Buat jadwal
            </Button>
            <CampaignDetailActions
              campaign={{
                id: c.id,
                brandId: c.brandId,
                budgetId: c.budgetId,
                title: c.title,
                description: c.description ?? "",
                startDate: c.startDate ?? "",
                endDate: c.endDate ?? "",
                picUserId: c.picUserId ?? "",
              }}
              brands={brands}
              budgets={budgets.map((b) => ({
                id: b.id,
                name: b.name,
                brandId: b.brandId,
                remaining: b.remaining,
              }))}
              users={users}
            />
          </>
        )
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <LabCard className="p-5">
          <h2 className={cn(lab.sectionTitle, "mb-3")}>Biaya campaign</h2>
          <p className="text-2xl font-bold tabular-nums">{rupiah(c.committedSpend)}</p>
          <p className="text-muted-foreground text-xs">
            dari {c.scheduleCount} jadwal · {c.pendingCount} menunggu · {c.postedCount} tayang
          </p>
        </LabCard>
        <LabCard className="p-5">
          <h2 className={cn(lab.sectionTitle, "mb-3")}>Budget: {c.budgetName}</h2>
          {budget ? (
            <BudgetMeter
              beginning={budget.beginning}
              committed={budget.committed}
              pending={budget.pending}
            />
          ) : (
            <p className="text-muted-foreground text-sm">Budget diarsipkan.</p>
          )}
          <p className="text-muted-foreground mt-2 text-[11px]">
            Budget ini bisa dipakai beberapa campaign sekaligus.
          </p>
        </LabCard>
      </div>

      {c.description ? (
        <p className="text-muted-foreground max-w-3xl text-sm whitespace-pre-line">{c.description}</p>
      ) : null}

      <section className={lab.section}>
        <h2 className={lab.sectionTitle}>Jadwal di campaign ini</h2>
        {schedules.length === 0 ? (
          <LabEmptyState
            icon={ClipboardList}
            title="Belum ada jadwal"
            description="Tambahkan KOL ke campaign ini lewat schedule builder."
          />
        ) : (
          <ScheduleTable rows={schedules} hideCampaign />
        )}
      </section>
    </LabDetailPage>
  );
}
