import { NotificationType } from "@prisma/client";

export function hrefForNotificationType(type: NotificationType): string {
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
