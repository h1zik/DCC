import Link from "next/link";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ExecCoreData } from "@/lib/executive-dashboard";
import { cn } from "@/lib/utils";

function MiniStat({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href?: string;
  tone: "danger" | "warning" | "neutral";
}) {
  const active = value > 0 && tone !== "neutral";
  const body = (
    <>
      <span
        className={cn(
          "font-mono text-2xl font-semibold tracking-tight tabular-nums",
          active && tone === "danger" && "text-destructive",
          active && tone === "warning" && "text-amber-600 dark:text-amber-400",
          !active && "text-foreground",
        )}
      >
        {value}
      </span>
      <span className="text-xs leading-snug text-muted-foreground">{label}</span>
    </>
  );
  const className =
    "flex flex-col gap-0.5 rounded-xl bg-muted/30 px-3.5 py-3 transition-colors";
  return href ? (
    <Link href={href} className={cn(className, "hover:bg-muted/60")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function ExecTeamHealth({
  kpi,
  team,
}: {
  kpi: ExecCoreData["kpi"];
  team: ExecCoreData["team"];
}) {
  const att = team.attendance;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tim &amp; tugas</CardTitle>
        <CardDescription>
          Beban kerja lintas ruangan dan kehadiran hari ini.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <MiniStat
            label="Overdue"
            value={kpi.overdueTasks}
            href="/overdue"
            tone="danger"
          />
          <MiniStat
            label="Terblokir"
            value={team.blocked}
            href="/tasks"
            tone="warning"
          />
          <MiniStat
            label="Tenggat 7 hari"
            value={team.dueNext7Days}
            tone="neutral"
          />
          <MiniStat
            label="Belum lengkap"
            value={kpi.incompleteTasks}
            href="/overdue?tab=incomplete"
            tone="warning"
          />
        </div>

        {att ? (
          <Link
            href="/attendance/rekap"
            className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border/70 px-3 py-2.5 text-sm transition-colors hover:bg-muted/40"
          >
            <span className="flex items-center gap-2 font-medium text-foreground">
              <Users className="size-4 text-muted-foreground" aria-hidden />
              Hadir{" "}
              <span className="font-mono tabular-nums">
                {att.checkIn}/{att.totalUsers}
              </span>
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              Sakit {att.sick} · Izin {att.permission} · Belum tercatat{" "}
              {att.absentEstimate}
            </span>
          </Link>
        ) : null}

        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Tenggat terdekat
          </p>
          {team.upcoming.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Tidak ada tenggat dalam 7 hari ke depan.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border/60">
              {team.upcoming.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {t.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.contextLabel}
                      {t.assignees.length > 0
                        ? ` · ${t.assignees.join(", ")}`
                        : " · belum ada PIC"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">
                    {format(new Date(t.dueDate), "EEE, d MMM", { locale: idLocale })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
