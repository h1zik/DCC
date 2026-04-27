import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Jadwal</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Meeting dan acara umum (tidak terikat ruangan). Pilih peserta — mereka
          mendapat notifikasi di aplikasi pada H-1 (±24 jam sebelum mulai) dan
          sekitar 1 jam sebelum mulai. Jadwal juga bisa dibuat berulang (harian,
          mingguan, bulanan) dari form tambah. Pastikan job cron memanggil{" "}
          <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">
            /api/cron/task-sync
          </code>{" "}
          dengan header{" "}
          <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">
            Authorization: Bearer CRON_SECRET
          </code>{" "}
          beberapa kali per hari.
        </p>
      </div>
      <ScheduleClient
        initialEvents={initialEvents}
        users={users}
        currentUserId={session.user.id}
        currentRole={session.user.role as UserRole}
      />
    </div>
  );
}
