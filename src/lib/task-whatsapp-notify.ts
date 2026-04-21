import { RoomMemberRole, TaskPriority } from "@prisma/client";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { taskProjectContextLabel } from "@/lib/room-simple-hub";
import {
  isTwilioWhatsAppConfigured,
  normalizeWhatsAppE164,
  sendTwilioWhatsAppTemplate,
} from "@/lib/twilio-whatsapp";

type ProjectForLabel = Parameters<typeof taskProjectContextLabel>[0];

function priorityLabelId(p: TaskPriority): string {
  switch (p) {
    case TaskPriority.LOW:
      return "Rendah";
    case TaskPriority.MEDIUM:
      return "Sedang";
    case TaskPriority.HIGH:
      return "Tinggi";
    default:
      return String(p);
  }
}

function clip(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/**
 * PIC baru / PIC diganti — **2 variabel** saja ({{1}}, {{2}}) agar lolos aturan Meta:
 * "too many variables for its length". Gabungkan detail di {{2}}.
 */
export async function notifyPicTaskViaWhatsApp(params: {
  assigneeId: string;
  headline: "new" | "pic_changed";
  task: {
    title: string;
    priority: TaskPriority;
    dueDate: Date | null;
  };
  project: ProjectForLabel;
}): Promise<void> {
  const contentSid = process.env["TWILIO_CONTENT_SID_TASK_PIC"]?.trim();
  if (!contentSid || !isTwilioWhatsAppConfigured()) return;

  const user = await prisma.user.findUnique({
    where: { id: params.assigneeId },
    select: { name: true, whatsappPhone: true },
  });
  const phone = normalizeWhatsAppE164(user?.whatsappPhone);
  if (!phone) return;

  const name = user?.name?.trim() || "Rekan";
  const projectLabel = taskProjectContextLabel(params.project);
  const dueLabel = params.task.dueDate
    ? format(params.task.dueDate, "d MMM yyyy", { locale: idLocale })
    : "—";
  const eventLabel =
    params.headline === "new"
      ? "Anda ditetapkan sebagai PIC untuk tugas ini."
      : "PIC tugas ini diperbarui ke Anda.";

  const line1 = clip(`Halo ${name}. ${eventLabel}`, 400);
  const line2 = clip(
    [
      `Judul: ${params.task.title}`,
      `Proyek: ${projectLabel}`,
      `Jatuh tempo: ${dueLabel}`,
      `Prioritas: ${priorityLabelId(params.task.priority)}`,
    ].join("\n"),
    1000,
  );

  try {
    await sendTwilioWhatsAppTemplate({
      toE164: phone,
      contentSid,
      variables: {
        "1": line1,
        "2": line2,
      },
    });
  } catch (e) {
    console.error("[task-whatsapp] PIC notify failed", e);
  }
}

/** Tugas selesai — manager / PM ruangan: **{{1}}**, **{{2}}** saja. */
export async function notifyRoomManagersTaskDoneViaWhatsApp(params: {
  roomId: string;
  taskTitle: string;
  project: ProjectForLabel;
  picDisplayName: string | null;
}): Promise<void> {
  const contentSid = process.env["TWILIO_CONTENT_SID_TASK_DONE_MANAGER"]?.trim();
  if (!contentSid || !isTwilioWhatsAppConfigured()) return;

  const managers = await prisma.roomMember.findMany({
    where: {
      roomId: params.roomId,
      role: {
        in: [
          RoomMemberRole.ROOM_MANAGER,
          RoomMemberRole.ROOM_PROJECT_MANAGER,
        ],
      },
    },
    include: {
      user: { select: { name: true, whatsappPhone: true } },
    },
  });

  const projectLabel = taskProjectContextLabel(params.project);
  const pic = params.picDisplayName?.trim() || "—";

  for (const m of managers) {
    const phone = normalizeWhatsAppE164(m.user.whatsappPhone);
    if (!phone) continue;
    const mgrName = m.user.name?.trim() || "Manager";
    const line1 = clip(`Halo ${mgrName}.`, 200);
    const line2 = clip(
      [
        "Tugas ditandai selesai.",
        `Judul: ${params.taskTitle}`,
        `Proyek: ${projectLabel}`,
        `PIC: ${pic}`,
      ].join("\n"),
      1000,
    );
    try {
      await sendTwilioWhatsAppTemplate({
        toE164: phone,
        contentSid,
        variables: {
          "1": line1,
          "2": line2,
        },
      });
    } catch (e) {
      console.error("[task-whatsapp] manager done notify failed", e);
    }
  }
}

/** Pengingat deadline ke PIC: **{{1}}**, **{{2}}** saja. */
export async function notifyPicDeadlineReminderViaWhatsApp(params: {
  assignee: { name: string | null; whatsappPhone: string | null };
  whenLabel: string;
  taskTitle: string;
  dueDate: Date;
  project: ProjectForLabel;
}): Promise<boolean> {
  const contentSid = process.env["TWILIO_CONTENT_SID_TASK_REMINDER"]?.trim();
  if (!contentSid || !isTwilioWhatsAppConfigured()) return false;

  const phone = normalizeWhatsAppE164(params.assignee.whatsappPhone);
  if (!phone) return false;

  const name = params.assignee.name?.trim() || "Rekan";
  const projectLabel = taskProjectContextLabel(params.project);
  const dueLabel = format(params.dueDate, "d MMM yyyy", { locale: idLocale });

  const line1 = clip(`Halo ${name}. Pengingat: ${params.whenLabel}`, 400);
  const line2 = clip(
    [
      `Tugas: ${params.taskTitle}`,
      `Proyek: ${projectLabel}`,
      `Jatuh tempo: ${dueLabel}`,
    ].join("\n"),
    1000,
  );

  try {
    await sendTwilioWhatsAppTemplate({
      toE164: phone,
      contentSid,
      variables: {
        "1": line1,
        "2": line2,
      },
    });
    return true;
  } catch (e) {
    console.error("[task-whatsapp] reminder failed", e);
    return false;
  }
}
