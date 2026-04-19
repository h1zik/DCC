import { NotificationType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function notifyUser(
  userId: string,
  message: string,
  type: NotificationType,
) {
  await prisma.notification.create({
    data: { userId, message, type },
  });
}

export async function notifyCeo(
  message: string,
  type: NotificationType = NotificationType.CEO_APPROVAL_REQUESTED,
) {
  const ceos = await prisma.user.findMany({
    where: { role: UserRole.CEO },
    select: { id: true },
  });
  await Promise.all(
    ceos.map((u) => notifyUser(u.id, message, type)),
  );
}

export async function notifyTaskCompletedForCeo(
  taskTitle: string,
  brandName: string,
) {
  await notifyCeo(
    `Tugas selesai: ${taskTitle} · ${brandName}`,
    NotificationType.TASK_COMPLETED,
  );
}
