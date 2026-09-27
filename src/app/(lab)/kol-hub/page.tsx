import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarPlus,
  Inbox,
  Megaphone,
  UserPlus,
  Wallet,
} from "lucide-react";
import { BudgetMeter } from "@/components/kol-hub/budget-meter";
import { PlatformMark, ScheduleStatusBadge } from "@/components/kol-hub/kol-badges";
import { LabModulePage } from "@/components/lab/lab-module-page";
import { LabCard, LabEmptyState, lab } from "@/components/lab/lab-primitives";
import { Button } from "@/components/ui/button";
import { rupiahShort } from "@/lib/kol/format";
import {
  PLACEMENT_LABEL,
  SCHEDULE_STATUS_META,
  SCHEDULE_STATUS_ORDER,
} from "@/lib/kol/labels";
import { getKolHubOverview } from "@/lib/kol/readers";
import { formatWibTime, wibDayKey } from "@/lib/kol/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "KOL Hub" };

const dayFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "short",
});
const dateNumFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
});
const monthFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  month: "short",
});

export default async function KolHubOverviewPage() {
  const o = await getKolHubOverview();

  const actions = [
    {
      show: o.approvals.total > 0,
      href: "/kol-hub/approvals",
      icon: Inbox,
      text: `${o.approvals.total} pengajuan menunggu keputusan`,
      detail: `${o.approvals.schedules} jadwal · ${o.approvals.changes} profil KOL`,
      tone: "accent" as const,
    },
    {
      show: o.overdue > 0,
      href: "/kol-hub/schedules?status=APPROVED",
      icon: AlertTriangle,
      text: `${o.overdue} jadwal lewat tanggal tayang`,
      detail: "Sudah disetujui tapi link post belum dicatat",
      tone: "danger" as const,
    },
  ].filter((a) => a.show);

  // Kelompokkan run sheet per hari WIB.
  const days = new Map<string, typeof o.upcoming>();
  for (const s of o.upcoming) {
    if (!s.scheduledAt) continue;
    const key = wibDayKey(s.scheduledAt);
    days.set(key, [...(days.get(key) ?? []), s]);
  }

  const pipelineTotal = SCHEDULE_STATUS_ORDER.filter(
    (s) => s !== "REJECTED" && s !== "CANCELLED",
  ).reduce((acc, s) => acc + o.statusCounts[s], 0);

  return (
    <LabModulePage
      icon={Megaphone}
      eyebrow="KOL Hub"
      title="Endorsement yang sedang berjalan"
      description="Siapa tayang kapan, berapa biayanya, dan apa yang menunggu keputusan."
      right={
        <>
          <Button variant="outline" size="sm" render={<Link href="/kol-hub/kols/new" />}>
            <UserPlus />
            Tambah KOL
          </Button>
          <Button size="sm" render={<Link href="/kol-hub/schedules/new" />}>
            <CalendarPlus />
            Buat jadwal
          </Button>
        </>
      }
    >
      {actions.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {actions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={cn(
                lab.panel,
                "flex items-center gap-3 p-4 transition-colors hover:border-[color-mix(in_srgb,var(--lab-accent,var(--primary))_40%,var(--border))]",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl",
                  a.tone === "danger"
                    ? "bg-red-500/12 text-red-600 dark:text-red-400"
                    : "bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_14%,transparent)] text-[var(--lab-accent,var(--primary))]",
                )}
              >
                <a.icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{a.text}</span>
                <span className="text-muted-foreground block text-xs">{a.detail}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Run sheet: satu-satunya elemen "berani" di halaman ini. */}
        <LabCard className="p-0">
          <div className="flex items-end justify-between gap-3 border-b border-border/70 px-5 py-4">
            <div>
              <h2 className={lab.sectionTitle}>Tayang 14 hari ke depan</h2>
              <p className="text-muted-foreground text-xs">
                Jadwal yang sudah disetujui, diurutkan per hari (WIB).
              </p>
            </div>
            <Link
              href="/kol-hub/calendar"
              className="text-xs font-medium text-[var(--lab-accent,var(--primary))] hover:underline"
            >
              Buka kalender
            </Link>
          </div>
          {days.size === 0 ? (
            <div className="p-5">
              <LabEmptyState
                icon={CalendarPlus}
                title="Belum ada yang tayang dalam 14 hari"
                description="Jadwal muncul di sini setelah disetujui approver."
                action={
                  <Button size="sm" render={<Link href="/kol-hub/schedules/new" />}>
                    Buat jadwal
                  </Button>
                }
              />
            </div>
          ) : (
            <ol className="divide-y divide-border/60">
              {[...days.entries()].map(([day, rows]) => {
                const d = new Date(`${day}T12:00:00+07:00`);
                return (
                  <li key={day} className="grid grid-cols-[64px_minmax(0,1fr)] gap-0">
                    <div className="border-r border-border/60 px-3 py-3 text-center">
                      <p className="text-muted-foreground text-[11px] capitalize">
                        {dayFmt.format(d)}
                      </p>
                      <p className="text-2xl leading-none font-bold tabular-nums">
                        {dateNumFmt.format(d)}
                      </p>
                      <p className="text-muted-foreground text-[11px]">{monthFmt.format(d)}</p>
                    </div>
                    <ul className="divide-y divide-border/40">
                      {rows.map((s) => (
                        <li key={s.id}>
                          <Link
                            href={`/kol-hub/schedules/${s.id}`}
                            className="hover:bg-muted/40 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 transition-colors"
                          >
                            <span className="w-11 text-xs font-semibold tabular-nums">
                              {formatWibTime(s.scheduledAt)}
                            </span>
                            <PlatformMark platform={s.platform} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {s.kolName}{" "}
                                <span className="text-muted-foreground font-normal">
                                  @{s.handle} · {PLACEMENT_LABEL[s.placement]}
                                </span>
                              </span>
                              <span className="text-muted-foreground block truncate text-xs">
                                {s.brandName} — {s.campaignTitle}
                              </span>
                            </span>
                            <ScheduleStatusBadge status={s.status} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ol>
          )}
        </LabCard>

        <div className="flex flex-col gap-6">
          <LabCard className="p-5">
            <h2 className={cn(lab.sectionTitle, "mb-3")}>Jadwal per status</h2>
            {pipelineTotal === 0 ? (
              <p className="text-muted-foreground text-sm">Belum ada jadwal.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {SCHEDULE_STATUS_ORDER.map((s) => (
                  <li key={s}>
                    <Link
                      href={`/kol-hub/schedules?status=${s}`}
                      className="hover:bg-muted/50 -mx-2 flex items-center justify-between rounded-lg px-2 py-1 text-sm transition-colors"
                    >
                      <span className="text-muted-foreground">
                        {SCHEDULE_STATUS_META[s].label}
                      </span>
                      <span className="font-semibold tabular-nums">{o.statusCounts[s]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-muted-foreground mt-3 border-t border-border/60 pt-3 text-xs">
              {o.postedLast30} konten tayang dalam 30 hari terakhir.
            </p>
          </LabCard>

          <LabCard className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className={lab.sectionTitle}>Database KOL</h2>
              <Link
                href="/kol-hub/kols"
                className="text-xs font-medium text-[var(--lab-accent,var(--primary))] hover:underline"
              >
                Lihat semua
              </Link>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Aktif", value: o.kolStats.active },
                { label: "Menunggu", value: o.kolStats.waiting },
                { label: "Blacklist", value: o.kolStats.blacklisted },
              ].map((x) => (
                <div key={x.label} className={lab.nestedPanel}>
                  <dt className="text-muted-foreground text-[11px]">{x.label}</dt>
                  <dd className="text-xl font-bold tabular-nums">{x.value}</dd>
                </div>
              ))}
            </dl>
          </LabCard>
        </div>
      </div>

      <section className={lab.section}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className={lab.sectionTitle}>Budget endorsement</h2>
            <p className={lab.sectionDesc}>
              Total {rupiahShort(o.budgetTotals.beginning)} · terpakai{" "}
              {rupiahShort(o.budgetTotals.committed)} · sisa{" "}
              {rupiahShort(o.budgetTotals.remaining)}
            </p>
          </div>
          <Link
            href="/kol-hub/settings/budgets"
            className="text-xs font-medium text-[var(--lab-accent,var(--primary))] hover:underline"
          >
            Kelola budget
          </Link>
        </div>
        {o.budgets.length === 0 ? (
          <LabEmptyState
            icon={Wallet}
            title="Belum ada budget"
            description="Budget per brand dibutuhkan sebelum membuat campaign. Approver KOL Hub yang bisa membuatnya."
            action={
              <Button size="sm" variant="outline" render={<Link href="/kol-hub/settings/budgets" />}>
                Buat budget
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {o.budgets.map((b) => (
              <div key={b.id} className={cn(lab.panel, "flex flex-col gap-3 p-4")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{b.name}</p>
                    <p className="text-muted-foreground text-xs">{b.brandName}</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{rupiahShort(b.beginning)}</p>
                </div>
                <BudgetMeter beginning={b.beginning} committed={b.committed} pending={b.pending} />
              </div>
            ))}
          </div>
        )}
      </section>
    </LabModulePage>
  );
}
