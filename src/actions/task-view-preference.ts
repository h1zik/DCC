"use server";

import { TaskWorkspaceView } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const setDefaultTaskViewSchema = z.object({
  view: z.nativeEnum(TaskWorkspaceView),
});

export async function setDefaultTaskWorkspaceView(
  input: z.infer<typeof setDefaultTaskViewSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Belum masuk.");
  }
  const data = setDefaultTaskViewSchema.parse(input);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { taskDefaultWorkspaceView: data.view },
  });
}
