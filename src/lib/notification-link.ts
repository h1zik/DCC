import { NotificationType } from "@prisma/client";

export function hrefForNotificationType(type: NotificationType): string {
  switch (type) {
    case NotificationType.CEO_APPROVAL_REQUESTED:
    case NotificationType.PROJECT_PIPELINE_APPROVAL_REQUESTED:
      return "/approvals";
    case NotificationType.SCHEDULE_REMINDER:
      return "/schedule";
    case NotificationType.ACHIEVEMENT_UNLOCKED:
      return "/profile";
    case NotificationType.SEO_ALERT:
      return "/seo/rank-tracker";
    case NotificationType.KOL_APPROVAL_REQUEST:
      return "/kol-hub/approvals";
    case NotificationType.KOL_APPROVAL_DECIDED:
      return "/kol-hub/schedules";
    default:
      return "/for-me";
  }
}
