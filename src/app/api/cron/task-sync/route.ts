import { syncTaskDeadlineWhatsAppReminders } from "@/lib/sync-task-deadline-reminders";
import { syncOverdueTasks } from "@/lib/sync-task-overdue";
import { syncScheduleReminders } from "@/lib/sync-schedule-reminders";

/**
 * Cron harian / beberapa kali sehari: overdue tugas + pengingat WA deadline + jadwal meeting.
 * **Wajib** dijadwalkan di Railway (atau penyedia lain): sinkron ini tidak lagi
 * dijalankan saat load halaman tugas/proyek agar UI tetap ringan.
 *
 * Lindungi dengan env `CRON_SECRET` (header `Authorization: Bearer …`).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET belum diset di environment." },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  await Promise.all([
    syncOverdueTasks(),
    syncTaskDeadlineWhatsAppReminders(),
    syncScheduleReminders(),
  ]);

  return Response.json({ ok: true });
}
