import "server-only";

import { NotificationType, ResearchReportType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { createAndGenerateReport } from "@/lib/research/reports/report-generator";

export async function generateWeeklyReports(): Promise<{ reportId: string }> {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  const analyst = await prisma.user.findFirst({
    where: { role: UserRole.MARKET_ANALYST },
    select: { id: true },
  });

  const creatorId =
    analyst?.id ??
    (
      await prisma.user.findFirst({
        where: { role: UserRole.CEO },
        select: { id: true },
      })
    )?.id;

  if (!creatorId) {
    throw new Error("Tidak ada user untuk membuat laporan mingguan.");
  }

  const { id } = await createAndGenerateReport({
    type: ResearchReportType.WEEKLY,
    config: { notify: true },
    createdById: creatorId,
    periodStart,
    periodEnd,
  });

  return { reportId: id };
}

export async function notifyWeeklyReportReady(): Promise<void> {
  const analysts = await prisma.user.findMany({
    where: { role: UserRole.MARKET_ANALYST },
    select: { id: true },
  });

  const message =
    "Laporan mingguan Research Hub sudah siap — buka Research Reports untuk melihat.";

  await Promise.allSettled(
    analysts.map((u) =>
      notifyUser(u.id, message, NotificationType.RESEARCH_ALERT),
    ),
  );
}

export async function syncWeeklyReports(): Promise<{ reportId: string }> {
  const result = await generateWeeklyReports();
  await notifyWeeklyReportReady();
  return result;
}
