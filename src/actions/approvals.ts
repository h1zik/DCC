"use server";

import { revalidatePath } from "next/cache";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function ceoApproveTask(taskId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== UserRole.CEO) {
    throw new Error("Hanya CEO yang dapat menyetujui.");
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { isApproved: true },
  });

  revalidatePath("/approvals");
  revalidatePath("/projects");
  revalidateTasksAndRoomHub();
}
