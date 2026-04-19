import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function recomputeProjectProgress(projectId: string) {
  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: { status: true },
  });
  if (tasks.length === 0) {
    await prisma.project.update({
      where: { id: projectId },
      data: { totalProgress: 0 },
    });
    return 0;
  }
  const done = tasks.filter((t) => t.status === TaskStatus.DONE).length;
  const pct = Math.round((done / tasks.length) * 100);
  await prisma.project.update({
    where: { id: projectId },
    data: { totalProgress: pct },
  });
  return pct;
}
