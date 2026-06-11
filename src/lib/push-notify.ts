import { NotificationType } from "@prisma/client";
import { getAppBranding } from "@/lib/app-branding";
import { prisma } from "@/lib/prisma";
import { isWebPushConfigured, sendWebPushMessage } from "@/lib/web-push";

function urlForNotificationType(type: NotificationType): string {
  switch (type) {
    case NotificationType.CEO_APPROVAL_REQUESTED:
    case NotificationType.PROJECT_PIPELINE_APPROVAL_REQUESTED:
      return "/approvals";
    case NotificationType.SCHEDULE_REMINDER:
      return "/schedule";
    default:
      return "/for-me";
  }
}

export async function sendPushToUser(
  userId: string,
  payload: {
    title: string;
    body: string;
    url?: string;
    icon?: string;
    tag?: string;
  },
) {
  if (!isWebPushConfigured()) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subscriptions.length === 0) return;

  const invalidIds: string[] = [];
  await Promise.all(
    subscriptions.map(async (sub) => {
      const sent = await sendWebPushMessage({
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        payload: {
          ...payload,
          tag: payload.tag ?? `dcc-user-${userId}`,
        },
      });
      if (!sent.ok && sent.reason === "gone") {
        invalidIds.push(sub.id);
      }
    }),
  );

  if (invalidIds.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: invalidIds } },
    });
  }
}

export async function sendPushToUsers(
  userIds: string[],
  payload: {
    title: string;
    body: string;
    url?: string;
    icon?: string;
    tag?: string;
  },
) {
  const unique = [...new Set(userIds)];
  await Promise.all(unique.map((userId) => sendPushToUser(userId, payload)));
}

/** Push untuk notifikasi in-app (tugas, approval, jadwal, dll.). */
export async function sendPushForInAppNotification(
  userId: string,
  message: string,
  type: NotificationType,
) {
  const branding = await getAppBranding();
  const pushIconPath = branding.pushIconPath ?? "/next.svg";
  const title = branding.appName?.trim() || "Dominatus";
  await sendPushToUser(userId, {
    title,
    body: message,
    url: urlForNotificationType(type),
    icon: pushIconPath,
    tag: `dcc-notif-${type}`,
  });
}
