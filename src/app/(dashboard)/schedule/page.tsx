import { UserRole } from "@prisma/client";
import { CalendarDays, Info } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PageHero, PageHeroChip } from "@/components/page-hero";
import { ScheduleClient, type ScheduleEventRow } from "./schedule-client";

export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const rangeStart = new Date();
  rangeStart.setMonth(rangeStart.getMonth() - 6);
  const rangeEnd = new Date();
  rangeEnd.setMonth(rangeEnd.getMonth() + 18);

  const [events, users] = await Promise.all([
    prisma.scheduleEvent.findMany({
      where: {
        startsAt: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      },
      orderBy: { startsAt: "asc" },
      include: {
        createdBy: { select: { name: true, email: true } },
        participants: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { email: "asc" },
    }),
  ]);

  const initialEvents: ScheduleEventRow[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    location: e.location,
    startsAt: e.startsAt.toISOString(),
    recurrence: e.recurrence,
    recurrenceUntil: e.recurrenceUntil?.toISOString() ?? null,
    seriesId: e.seriesId,
    createdById: e.createdById,
    createdBy: e.createdBy,
    participants: e.participants.map((p) => ({ user: p.user })),
  }));

  const now = Date.now();
  const upcomingCount = initialEvents.filter(
    (e) => new Date(e.startsAt).getTime() >= now,
  ).length;
  const todayCount = initialEvents.filter((e) => {
    const d = new Date(e.startsAt);
    const t = new Date();
    return (
      d.getFullYear() === t.getFullYear() &&
      d.getMonth() === t.getMonth() &&
      d.getDate() === t.getDate()
    );
  }).length;

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <PageHero
        icon={CalendarDays}
        title="Jadwal"
        subtitle="Meeting dan acara umum (tidak terikat ruangan). Pilih peserta — mereka mendapat notifikasi H-1 dan ±1 jam sebelum mulai."
        right={
          <>
            <PageHeroChip>
              <span className="text-foreground font-semibold tabular-nums">
                {todayCount}
              </span>
              hari ini
            </PageHeroChip>
            <PageHeroChip>
              <span className="text-foreground font-semibold tabular-nums">
                {upcomingCount}
              </span>
              akan datang
            </PageHeroChip>
            <Popover>
              <PopoverTrigger
                render={
                  <Button type="button" variant="outline" size="sm">
                    <Info className="size-3.5" aria-hidden />
                    Catatan operasional
                  </Button>
                }
              />
              <PopoverContent className="text-muted-foreground w-80 space-y-2 text-xs leading-relaxed">
                <p className="text-foreground font-semibold">
                  Notifikasi otomatis
                </p>
                <p>
                  Pastikan job cron memanggil{" "}
                  <code className="text-foreground rounded bg-muted px-1 py-0.5">
                    /api/cron/task-sync
                  </code>{" "}
                  dengan header{" "}
                  <code className="text-foreground rounded bg-muted px-1 py-0.5">
                    Authorization: Bearer CRON_SECRET
                  </code>{" "}
                  beberapa kali per hari agar pengingat H-1 dan H-1 jam terkirim
                  tepat waktu.
                </p>
                <p>
                  Jadwal dapat dibuat berulang (harian, mingguan, bulanan) dari
                  form tambah.
                </p>
              </PopoverContent>
            </Popover>
          </>
        }
      />
      <ScheduleClient
        initialEvents={initialEvents}
        users={users}
        currentUserId={session.user.id}
        currentRole={session.user.role as UserRole}
      />
    </div>
  );
}
