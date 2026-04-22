import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function recomputeProjectProgress(projectId: string) {
  const [totalTasks, doneTasks] = await prisma.$transaction([
    prisma.task.count({
      where: { projectId, archivedAt: null },
    }),
    prisma.task.count({
      where: { projectId, archivedAt: null, status: TaskStatus.DONE },
    }),
  ]);
  if (totalTasks === 0) {
    await prisma.project.update({
      where: { id: projectId },
      data: { totalProgress: 0 },
    });
    return 0;
  }
  const pct = Math.round((doneTasks / totalTasks) * 100);
  await prisma.project.update({
    where: { id: projectId },
    data: { totalProgress: pct },
  });
  return pct;
}
