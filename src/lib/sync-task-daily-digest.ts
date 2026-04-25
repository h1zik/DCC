import { NotificationType, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { taskProjectContextLabel } from "@/lib/room-simple-hub";
import {
  isWhatsAppConfigured,
  normalizeWhatsAppE164,
  sendWhatsAppMessage,
} from "@/lib/whatsapp-gateway";

function jakartaNowParts(now: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour") || "0"),
  };
}

function buildDigestMessage(params: {
  name: string;
  todo: string[];
  inProgress: string[];
  overdue: string[];
}): string {
  const cap = (arr: string[]) => arr.slice(0, 5);
  const sec = (title: string, arr: string[]) =>
    `${title} (${arr.length})${
      arr.length > 0 ? `\n- ${cap(arr).join("\n- ")}${arr.length > 5 ? "\n- ..." : ""}` : ""
    }`;
  return [
    `Halo ${params.name} 👋`,
    "🗓️ Ringkasan tugas hari ini:",
    sec("📌 TODO", params.todo),
    sec("🚧 IN PROGRESS", params.inProgress),
    sec("🚨 OVERDUE", params.overdue),
  ].join("\n\n");
}

/** Digest harian jam 09:00 WIB per PIC (WA + in-app marker anti-duplikasi). */
export async function syncTaskDailyDigest(): Promise<void> {
  const now = new Date();
  const { dateKey, hour } = jakartaNowParts(now);
  if (hour !== 9) return;

  const tasks = await prisma.task.findMany({
    where: {
      archivedAt: null,
      status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.OVERDUE] },
      assignees: { some: {} },
    },
    include: {
      project: { include: { brand: true, room: { select: { name: true } } } },
      assignees: {
        include: { user: { select: { id: true, name: true, whatsappPhone: true } } },
      },
    },
  });

  const byUser = new Map<
    string,
    {
      name: string;
      phone: string | null;
      todo: string[];
      inProgress: string[];
      overdue: string[];
    }
  >();
  for (const t of tasks) {
    const label = `${t.title} (${taskProjectContextLabel(t.project)})`;
    for (const a of t.assignees) {
      const key = a.user.id;
      const row = byUser.get(key) ?? {
        name: a.user.name?.trim() || "Rekan",
        phone: a.user.whatsappPhone,
        todo: [],
        inProgress: [],
        overdue: [],
      };
      if (t.status === TaskStatus.TODO) row.todo.push(label);
      else if (t.status === TaskStatus.IN_PROGRESS) row.inProgress.push(label);
      else row.overdue.push(label);
      byUser.set(key, row);
    }
  }

  for (const [userId, row] of byUser) {
    const marker = `[DAILY_DIGEST ${dateKey}]`;
    const already = await prisma.notification.count({
      where: {
        userId,
        type: NotificationType.SCHEDULE_REMINDER,
        message: { startsWith: marker },
      },
    });
    if (already > 0) continue;

    const summary = `TODO ${row.todo.length} · IN PROGRESS ${row.inProgress.length} · OVERDUE ${row.overdue.length}`;
    await notifyUser(
      userId,
      `${marker} Ringkasan tugas: ${summary}`,
      NotificationType.SCHEDULE_REMINDER,
    );

    if (isWhatsAppConfigured()) {
      const phone = normalizeWhatsAppE164(row.phone);
      if (phone) {
        const message = buildDigestMessage({
          name: row.name,
          todo: row.todo,
          inProgress: row.inProgress,
          overdue: row.overdue,
        });
        try {
          await sendWhatsAppMessage({ toE164: phone, message });
        } catch (err) {
          console.error("[task-whatsapp] daily digest failed", err);
        }
      }
    }
  }
}
